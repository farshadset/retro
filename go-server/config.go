package main

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type RuntimeConfig struct {
	Port              int
	StoreMode         string
	RoomStoreMaxRooms int
	RoomStoreTTL      time.Duration
}

var runtimeConfig = loadRuntimeConfig()

func loadRuntimeConfig() RuntimeConfig {
	return RuntimeConfig{
		Port:              parseIntEnv("GO_CHESS_PORT", 4000),
		StoreMode:         parseStoreModeEnv(),
		RoomStoreMaxRooms: parseIntEnv("CHESS_ROOM_STORE_MAX_ROOMS", 500),
		RoomStoreTTL:      time.Duration(parseIntEnv("CHESS_ROOM_STORE_TTL_MS", 6*60*60*1000)) * time.Millisecond,
	}
}

func parseStoreModeEnv() string {
	value := strings.ToLower(strings.TrimSpace(os.Getenv("CHESS_STORE_MODE")))
	if value == "" {
		return "memory"
	}
	if value == "memory" || value == "redis" {
		return value
	}
	return "memory"
}

func parseIntEnv(name string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
