package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	if runtimeConfig.StoreMode != "memory" {
		log.Fatalf("unsupported CHESS_STORE_MODE=%q: only memory mode is implemented in current Go backend", runtimeConfig.StoreMode)
	}

	store := NewRoomStore()
	server := NewServer(store)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	log.Printf("go chess api listening on :%d", runtimeConfig.Port)
	if err := runHTTPServer(ctx, server.Handler()); err != nil {
		log.Fatalf("go chess api failed: %v", err)
	}
}
