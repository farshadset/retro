package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Server struct {
	store *RoomStore
	mux   *http.ServeMux
}

func NewServer(store *RoomStore) *Server {
	s := &Server{
		store: store,
		mux:   http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return withCORS(s.mux)
}

func (s *Server) routes() {
	s.mux.HandleFunc("/health", s.handleHealth)
	s.mux.HandleFunc("/api/health", s.handleHealth)
	s.mux.HandleFunc("/api/chess/rooms", s.handleRooms)
	s.mux.HandleFunc("/api/chess/rooms/", s.handleRoomByID)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeAPIError(w, NewChessAPIError(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed."))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"now":     time.Now().UTC().Format(time.RFC3339Nano),
		"runtime": s.store.DescribeStoreMode(),
	})
}

func (s *Server) handleRooms(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/chess/rooms" {
		writeAPIError(w, NotFound("NOT_FOUND", "Route not found."))
		return
	}
	if r.Method != http.MethodPost {
		writeAPIError(w, NewChessAPIError(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed."))
		return
	}

	type createRoomBody struct {
		Name               string `json:"name"`
		TimeControlMinutes *int   `json:"timeControlMinutes"`
		IncrementSeconds   *int   `json:"incrementSeconds"`
	}

	var body createRoomBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAPIError(w, BadRequest("INVALID_JSON", "Request body must be valid JSON."))
		return
	}

	minutes := 10
	if body.TimeControlMinutes != nil {
		minutes = *body.TimeControlMinutes
	}
	increment := 2
	if body.IncrementSeconds != nil {
		increment = *body.IncrementSeconds
	}

	if minutes < 1 || minutes > 60 {
		writeAPIError(w, BadRequest("INVALID_TIME_CONTROL", "timeControlMinutes must be between 1 and 60."))
		return
	}
	if increment < 0 || increment > 30 {
		writeAPIError(w, BadRequest("INVALID_INCREMENT", "incrementSeconds must be between 0 and 30."))
		return
	}

	snapshot, session, apiErr := s.store.CreateRoom(
		body.Name,
		int64(minutes)*60_000,
		int64(increment)*1_000,
	)
	if apiErr != nil {
		writeAPIError(w, apiErr)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"snapshot": snapshot,
		"session":  session,
	})
}

func (s *Server) handleRoomByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/chess/rooms/")
	path = strings.Trim(path, "/")
	if path == "" {
		writeAPIError(w, NotFound("NOT_FOUND", "Route not found."))
		return
	}

	parts := strings.Split(path, "/")
	roomID := strings.ToUpper(parts[0])

	if len(parts) == 1 {
		s.handleGetRoomSnapshot(w, r, roomID)
		return
	}

	switch parts[1] {
	case "join":
		s.handleJoinRoom(w, r, roomID)
	case "move":
		s.handleMove(w, r, roomID)
	case "resign":
		s.handleResign(w, r, roomID)
	case "events":
		s.handleEvents(w, r, roomID)
	default:
		writeAPIError(w, NotFound("NOT_FOUND", "Route not found."))
	}
}

func (s *Server) handleGetRoomSnapshot(w http.ResponseWriter, r *http.Request, roomID string) {
	if r.Method != http.MethodGet {
		writeAPIError(w, NewChessAPIError(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed."))
		return
	}
	snapshot, apiErr := s.store.GetRoomSnapshot(roomID)
	if apiErr != nil {
		writeAPIError(w, apiErr)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"snapshot": snapshot})
}

func (s *Server) handleJoinRoom(w http.ResponseWriter, r *http.Request, roomID string) {
	if r.Method != http.MethodPost {
		writeAPIError(w, NewChessAPIError(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed."))
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAPIError(w, BadRequest("INVALID_JSON", "Request body must be valid JSON."))
		return
	}
	snapshot, session, apiErr := s.store.JoinRoom(roomID, body.Name)
	if apiErr != nil {
		writeAPIError(w, apiErr)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"snapshot": snapshot,
		"session":  session,
	})
}

func (s *Server) handleMove(w http.ResponseWriter, r *http.Request, roomID string) {
	if r.Method != http.MethodPost {
		writeAPIError(w, NewChessAPIError(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed."))
		return
	}
	var body struct {
		Token     string `json:"token"`
		From      string `json:"from"`
		To        string `json:"to"`
		Promotion string `json:"promotion"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAPIError(w, BadRequest("INVALID_JSON", "Request body must be valid JSON."))
		return
	}
	snapshot, apiErr := s.store.MakeMove(roomID, body.Token, body.From, body.To, body.Promotion)
	if apiErr != nil {
		writeAPIError(w, apiErr)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"snapshot": snapshot})
}

func (s *Server) handleResign(w http.ResponseWriter, r *http.Request, roomID string) {
	if r.Method != http.MethodPost {
		writeAPIError(w, NewChessAPIError(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed."))
		return
	}
	var body struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAPIError(w, BadRequest("INVALID_JSON", "Request body must be valid JSON."))
		return
	}
	snapshot, apiErr := s.store.Resign(roomID, body.Token)
	if apiErr != nil {
		writeAPIError(w, apiErr)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"snapshot": snapshot})
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request, roomID string) {
	if r.Method != http.MethodGet {
		writeAPIError(w, NewChessAPIError(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed."))
		return
	}

	snapshot, snapshotErr := s.store.GetRoomSnapshot(roomID)
	if snapshotErr != nil {
		writeAPIError(w, snapshotErr)
		return
	}

	events, unsubscribe, apiErr := s.store.Subscribe(roomID)
	if apiErr != nil {
		writeAPIError(w, apiErr)
		return
	}
	defer unsubscribe()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeAPIError(w, InternalServerError("UNSUPPORTED_STREAM", "Streaming is not supported by this server."))
		return
	}

	if err := writeSSE(w, "connected", map[string]any{"ok": true, "roomId": roomID}); err != nil {
		return
	}
	if err := writeSSE(w, "snapshot", snapshot); err != nil {
		return
	}
	flusher.Flush()

	ctx := r.Context()
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := w.Write([]byte(": ping\n\n")); err != nil {
				return
			}
			flusher.Flush()
		case event, ok := <-events:
			if !ok {
				return
			}
			if err := writeSSE(w, event.Type, event.Snapshot); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func writeSSE(w http.ResponseWriter, eventName string, payload any) error {
	bytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte("event: " + eventName + "\n")); err != nil {
		return err
	}
	if _, err := w.Write([]byte("data: " + string(bytes) + "\n\n")); err != nil {
		return err
	}
	return nil
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func runHTTPServer(ctx context.Context, handler http.Handler) error {
	server := &http.Server{
		Addr:              ":" + strconv.Itoa(runtimeConfig.Port),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
		return nil
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}
