package main

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/notnil/chess"
)

const (
	roomIDLength = 6
)

type roomEvent struct {
	ID       int64
	Type     string
	RoomID   string
	At       int64
	Snapshot RoomSnapshot
}

type sessionRecord struct {
	Token    string
	PlayerID string
	Color    *PlayerColor
	Name     string
}

type roomState struct {
	ID string

	Status     RoomStatus
	Game       *chess.Game
	Notation   chess.AlgebraicNotation
	MoveSAN    []string
	LastMove   *LastMove
	Winner     *PlayerColor
	DrawReason *string

	Players struct {
		White *RoomPlayer
		Black *RoomPlayer
	}
	SessionsByToken map[string]*sessionRecord

	Subscribers map[int64]chan roomEvent
	SubSeq      int64
	EventSeq    int64

	TimeControlMs int64
	IncrementMs   int64
	WhiteTimeMs   int64
	BlackTimeMs   int64
	ActiveSince   *int64
	CreatedAt     int64
	UpdatedAt     int64
}

type RoomStore struct {
	mu    sync.RWMutex
	rooms map[string]*roomState
}

func NewRoomStore() *RoomStore {
	rand.Seed(time.Now().UnixNano())
	return &RoomStore{
		rooms: make(map[string]*roomState),
	}
}

func normalizeRoomID(roomID string) string {
	return strings.ToUpper(strings.TrimSpace(roomID))
}

func normalizeTurn(color chess.Color) PlayerColor {
	if color == chess.White {
		return PlayerWhite
	}
	return PlayerBlack
}

func outcomeWinner(outcome chess.Outcome) *PlayerColor {
	switch outcome {
	case chess.WhiteWon:
		w := PlayerWhite
		return &w
	case chess.BlackWon:
		b := PlayerBlack
		return &b
	default:
		return nil
	}
}

func methodToDrawReason(method chess.Method) *string {
	var label string
	switch method {
	case chess.Stalemate:
		label = "Stalemate"
	case chess.ThreefoldRepetition:
		label = "Threefold repetition"
	case chess.FiftyMoveRule:
		label = "Fifty-move rule"
	case chess.InsufficientMaterial:
		label = "Insufficient material"
	default:
		label = "Draw"
	}
	return &label
}

func randomRoomID() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var out strings.Builder
	for i := 0; i < roomIDLength; i++ {
		out.WriteByte(alphabet[rand.Intn(len(alphabet))])
	}
	return out.String()
}

func cloneColor(color *PlayerColor) *PlayerColor {
	if color == nil {
		return nil
	}
	c := *color
	return &c
}

func cloneString(value *string) *string {
	if value == nil {
		return nil
	}
	v := *value
	return &v
}

func cloneLastMove(move *LastMove) *LastMove {
	if move == nil {
		return nil
	}
	cp := *move
	return &cp
}

func clonePlayer(player *RoomPlayer) *RoomPlayer {
	if player == nil {
		return nil
	}
	cp := *player
	return &cp
}

func (s *RoomStore) cleanupExpiredLocked(now time.Time) {
	maxRooms := runtimeConfig.RoomStoreMaxRooms
	roomTTL := runtimeConfig.RoomStoreTTL
	for roomID, room := range s.rooms {
		if now.Sub(time.UnixMilli(room.UpdatedAt)) > roomTTL && len(room.Subscribers) == 0 {
			delete(s.rooms, roomID)
		}
	}
	if len(s.rooms) <= maxRooms {
		return
	}

	type roomAge struct {
		roomID string
		at     int64
	}
	var ages []roomAge
	for roomID, room := range s.rooms {
		ages = append(ages, roomAge{roomID: roomID, at: room.UpdatedAt})
	}
	sort.Slice(ages, func(i, j int) bool {
		return ages[i].at < ages[j].at
	})
	for _, age := range ages {
		if len(s.rooms) <= maxRooms {
			break
		}
		room := s.rooms[age.roomID]
		if room != nil && len(room.Subscribers) == 0 {
			delete(s.rooms, age.roomID)
		}
	}
}

func (s *RoomStore) getRoomLocked(roomID string) (*roomState, *ChessAPIError) {
	id := normalizeRoomID(roomID)
	room, ok := s.rooms[id]
	if !ok {
		return nil, NotFound("ROOM_NOT_FOUND", "Room not found.")
	}
	return room, nil
}

func buildPGN(history []string) string {
	if len(history) == 0 {
		return ""
	}
	var chunks []string
	moveNo := 1
	for i := 0; i < len(history); i += 2 {
		if i+1 < len(history) {
			chunks = append(chunks, fmt.Sprintf("%d. %s %s", moveNo, history[i], history[i+1]))
		} else {
			chunks = append(chunks, fmt.Sprintf("%d. %s", moveNo, history[i]))
		}
		moveNo++
	}
	return strings.Join(chunks, " ")
}

func (s *RoomStore) snapshotForLocked(room *roomState) RoomSnapshot {
	spectators := 0
	for _, session := range room.SessionsByToken {
		if session.Color == nil {
			spectators++
		}
	}
	return RoomSnapshot{
		RoomID:     room.ID,
		Status:     room.Status,
		FEN:        room.Game.FEN(),
		PGN:        buildPGN(room.MoveSAN),
		Turn:       normalizeTurn(room.Game.Position().Turn()),
		Winner:     cloneColor(room.Winner),
		DrawReason: cloneString(room.DrawReason),
		LastMove:   cloneLastMove(room.LastMove),
		Moves:      append([]string{}, room.MoveSAN...),
		Players: RoomPlayers{
			White: clonePlayer(room.Players.White),
			Black: clonePlayer(room.Players.Black),
		},
		SpectatorCount: spectators,
		TimeControlMs:  room.TimeControlMs,
		IncrementMs:    room.IncrementMs,
		WhiteTimeMs:    room.WhiteTimeMs,
		BlackTimeMs:    room.BlackTimeMs,
		ActiveSince:    cloneInt64Pointer(room.ActiveSince),
		CreatedAt:      room.CreatedAt,
		UpdatedAt:      room.UpdatedAt,
	}
}

func cloneInt64Pointer(value *int64) *int64 {
	if value == nil {
		return nil
	}
	v := *value
	return &v
}

func (s *RoomStore) emitLocked(room *roomState, eventType string) RoomSnapshot {
	snapshot := s.snapshotForLocked(room)
	event := roomEvent{
		ID:       room.EventSeq,
		Type:     eventType,
		RoomID:   room.ID,
		At:       time.Now().UnixMilli(),
		Snapshot: snapshot,
	}
	room.EventSeq++
	for _, ch := range room.Subscribers {
		select {
		case ch <- event:
		default:
		}
	}
	return snapshot
}

func (s *RoomStore) applyTurnClockLocked(room *roomState, now int64) bool {
	if room.Status != StatusActive || room.ActiveSince == nil {
		return false
	}
	elapsed := now - *room.ActiveSince
	if elapsed <= 0 {
		return false
	}
	turn := normalizeTurn(room.Game.Position().Turn())
	if turn == PlayerWhite {
		room.WhiteTimeMs = maxI64(0, room.WhiteTimeMs-elapsed)
		if room.WhiteTimeMs == 0 {
			room.Status = StatusTimeout
			winner := PlayerBlack
			room.Winner = &winner
			room.DrawReason = nil
			room.ActiveSince = nil
			return true
		}
	} else {
		room.BlackTimeMs = maxI64(0, room.BlackTimeMs-elapsed)
		if room.BlackTimeMs == 0 {
			room.Status = StatusTimeout
			winner := PlayerWhite
			room.Winner = &winner
			room.DrawReason = nil
			room.ActiveSince = nil
			return true
		}
	}
	return false
}

func maxI64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func (s *RoomStore) CreateRoom(name string, timeControlMs int64, incrementMs int64) (RoomSnapshot, RoomSession, *ChessAPIError) {
	trimmed := strings.TrimSpace(name)
	if len([]rune(trimmed)) < 2 {
		return RoomSnapshot{}, RoomSession{}, BadRequest("INVALID_NAME", "Player name must be at least 2 characters.")
	}

	now := time.Now()
	nowMs := now.UnixMilli()

	s.mu.Lock()
	defer s.mu.Unlock()

	var roomID string
	for {
		candidate := randomRoomID()
		if _, exists := s.rooms[candidate]; !exists {
			roomID = candidate
			break
		}
	}

	playerID := uuid.NewString()
	token := uuid.NewString()
	white := &RoomPlayer{
		ID:    playerID,
		Name:  trimmed,
		Color: PlayerWhite,
	}
	room := &roomState{
		ID:              roomID,
		Status:          StatusWaiting,
		Game:            chess.NewGame(),
		Notation:        chess.AlgebraicNotation{},
		SessionsByToken: map[string]*sessionRecord{},
		Subscribers:     map[int64]chan roomEvent{},
		EventSeq:        1,
		TimeControlMs:   timeControlMs,
		IncrementMs:     incrementMs,
		WhiteTimeMs:     timeControlMs,
		BlackTimeMs:     timeControlMs,
		CreatedAt:       nowMs,
		UpdatedAt:       nowMs,
	}
	room.Players.White = white
	color := PlayerWhite
	room.SessionsByToken[token] = &sessionRecord{
		Token:    token,
		PlayerID: playerID,
		Color:    &color,
		Name:     trimmed,
	}

	s.rooms[roomID] = room
	s.cleanupExpiredLocked(now)

	snapshot := s.emitLocked(room, "room-created")
	session := RoomSession{
		Token:    token,
		PlayerID: playerID,
		Color:    &color,
		Name:     trimmed,
	}
	return snapshot, session, nil
}

func (s *RoomStore) JoinRoom(roomID string, name string) (RoomSnapshot, RoomSession, *ChessAPIError) {
	trimmed := strings.TrimSpace(name)
	if len([]rune(trimmed)) < 2 {
		return RoomSnapshot{}, RoomSession{}, BadRequest("INVALID_NAME", "Player name must be at least 2 characters.")
	}

	nowMs := time.Now().UnixMilli()

	s.mu.Lock()
	defer s.mu.Unlock()

	room, apiErr := s.getRoomLocked(roomID)
	if apiErr != nil {
		return RoomSnapshot{}, RoomSession{}, apiErr
	}

	token := uuid.NewString()
	playerID := uuid.NewString()
	var color *PlayerColor

	if room.Players.Black == nil {
		black := PlayerBlack
		color = &black
		room.Players.Black = &RoomPlayer{
			ID:    playerID,
			Name:  trimmed,
			Color: black,
		}
		if room.Status == StatusWaiting {
			room.Status = StatusActive
			room.ActiveSince = &nowMs
		}
	}

	room.SessionsByToken[token] = &sessionRecord{
		Token:    token,
		PlayerID: playerID,
		Color:    color,
		Name:     trimmed,
	}
	room.UpdatedAt = nowMs

	snapshot := s.emitLocked(room, "player-joined")
	session := RoomSession{
		Token:    token,
		PlayerID: playerID,
		Color:    cloneColor(color),
		Name:     trimmed,
	}
	return snapshot, session, nil
}

func (s *RoomStore) evaluateClockLocked(room *roomState) RoomSnapshot {
	if room.Status != StatusActive {
		return s.snapshotForLocked(room)
	}
	now := time.Now().UnixMilli()
	timedOut := s.applyTurnClockLocked(room, now)
	room.UpdatedAt = now
	if timedOut {
		return s.emitLocked(room, "game-over")
	}
	return s.snapshotForLocked(room)
}

func (s *RoomStore) GetRoomSnapshot(roomID string) (RoomSnapshot, *ChessAPIError) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, apiErr := s.getRoomLocked(roomID)
	if apiErr != nil {
		return RoomSnapshot{}, apiErr
	}
	s.evaluateClockLocked(room)
	return s.snapshotForLocked(room), nil
}

func (s *RoomStore) MakeMove(roomID, token, from, to, promotion string) (RoomSnapshot, *ChessAPIError) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, apiErr := s.getRoomLocked(roomID)
	if apiErr != nil {
		return RoomSnapshot{}, apiErr
	}
	session, ok := room.SessionsByToken[token]
	if !ok {
		return RoomSnapshot{}, Unauthorized("INVALID_TOKEN", "Invalid player session token.")
	}
	if session.Color == nil {
		return RoomSnapshot{}, Forbidden("SPECTATOR_FORBIDDEN", "Spectators cannot make moves.")
	}
	if room.Status != StatusActive {
		return RoomSnapshot{}, Conflict("GAME_NOT_ACTIVE", "Game is not active.")
	}

	clockSnapshot := s.evaluateClockLocked(room)
	if clockSnapshot.Status == StatusTimeout {
		return RoomSnapshot{}, Conflict("TIMEOUT", "Current player lost on time.")
	}

	turn := normalizeTurn(room.Game.Position().Turn())
	if turn != *session.Color {
		return RoomSnapshot{}, Forbidden("NOT_YOUR_TURN", "It is not your turn.")
	}

	from = strings.ToLower(strings.TrimSpace(from))
	to = strings.ToLower(strings.TrimSpace(to))
	moveStr := from + to
	if promotion != "" {
		moveStr += strings.ToLower(strings.TrimSpace(promotion))
	}

	validMoves := room.Game.ValidMoves()
	var selectedMove *chess.Move
	for _, candidate := range validMoves {
		if candidate.String() == moveStr {
			selectedMove = candidate
			break
		}
	}
	if selectedMove == nil {
		return RoomSnapshot{}, BadRequest("INVALID_MOVE", "Illegal move.")
	}

	san := room.Notation.Encode(room.Game.Position(), selectedMove)
	if err := room.Game.Move(selectedMove); err != nil {
		return RoomSnapshot{}, BadRequest("INVALID_MOVE", "Illegal move.")
	}

	room.MoveSAN = append(room.MoveSAN, san)
	room.LastMove = &LastMove{
		From: from,
		To:   to,
		SAN:  san,
	}

	if *session.Color == PlayerWhite {
		room.WhiteTimeMs += room.IncrementMs
	} else {
		room.BlackTimeMs += room.IncrementMs
	}

	outcome := room.Game.Outcome()
	method := room.Game.Method()
	now := time.Now().UnixMilli()

	switch outcome {
	case chess.WhiteWon, chess.BlackWon:
		room.Status = StatusCheckmate
		room.Winner = outcomeWinner(outcome)
		room.DrawReason = nil
		room.ActiveSince = nil
		room.UpdatedAt = now
		return s.emitLocked(room, "game-over"), nil
	case chess.Draw:
		room.Status = StatusDraw
		room.Winner = nil
		room.DrawReason = methodToDrawReason(method)
		room.ActiveSince = nil
		room.UpdatedAt = now
		return s.emitLocked(room, "game-over"), nil
	default:
		room.Status = StatusActive
		room.Winner = nil
		room.DrawReason = nil
		room.ActiveSince = &now
		room.UpdatedAt = now
		return s.emitLocked(room, "move"), nil
	}
}

func (s *RoomStore) Resign(roomID, token string) (RoomSnapshot, *ChessAPIError) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, apiErr := s.getRoomLocked(roomID)
	if apiErr != nil {
		return RoomSnapshot{}, apiErr
	}
	session, ok := room.SessionsByToken[token]
	if !ok {
		return RoomSnapshot{}, Unauthorized("INVALID_TOKEN", "Invalid player session token.")
	}
	if session.Color == nil {
		return RoomSnapshot{}, Forbidden("SPECTATOR_FORBIDDEN", "Spectators cannot resign.")
	}
	if room.Status != StatusActive && room.Status != StatusWaiting {
		return RoomSnapshot{}, Conflict("GAME_FINISHED", "Game is already finished.")
	}

	if *session.Color == PlayerWhite {
		winner := PlayerBlack
		room.Winner = &winner
		room.Game.Resign(chess.White)
	} else {
		winner := PlayerWhite
		room.Winner = &winner
		room.Game.Resign(chess.Black)
	}
	room.Status = StatusCheckmate
	reason := session.Name + " resigned"
	room.DrawReason = &reason
	room.ActiveSince = nil
	room.UpdatedAt = time.Now().UnixMilli()
	return s.emitLocked(room, "resigned"), nil
}

func (s *RoomStore) Subscribe(roomID string) (<-chan roomEvent, func(), *ChessAPIError) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, apiErr := s.getRoomLocked(roomID)
	if apiErr != nil {
		return nil, nil, apiErr
	}
	ch := make(chan roomEvent, 64)
	subID := room.SubSeq
	room.SubSeq++
	room.Subscribers[subID] = ch

	unsubscribe := func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		target, exists := s.rooms[room.ID]
		if !exists {
			return
		}
		sub, ok := target.Subscribers[subID]
		if ok {
			delete(target.Subscribers, subID)
			close(sub)
		}
	}
	return ch, unsubscribe, nil
}

func (s *RoomStore) DescribeStoreMode() map[string]any {
	return map[string]any{
		"storeMode":          "memory",
		"singleInstanceOnly": true,
	}
}
