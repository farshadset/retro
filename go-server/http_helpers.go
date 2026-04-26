package main

import (
	"encoding/json"
	"errors"
	"net/http"
)

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeAPIError(w http.ResponseWriter, err error) {
	var apiErr *ChessAPIError
	if errors.As(err, &apiErr) {
		writeJSON(w, apiErr.Status, map[string]any{
			"error": APIError{
				Code:    apiErr.Code,
				Message: apiErr.Message,
			},
		})
		return
	}

	writeJSON(w, http.StatusInternalServerError, map[string]any{
		"error": APIError{
			Code:    "INTERNAL_ERROR",
			Message: "Unexpected server error.",
		},
	})
}
