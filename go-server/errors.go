package main

import (
	"fmt"
	"net/http"
)

type ChessAPIError struct {
	Status  int
	Code    string
	Message string
}

func (e *ChessAPIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func NewChessAPIError(status int, code string, message string) *ChessAPIError {
	return &ChessAPIError{
		Status:  status,
		Code:    code,
		Message: message,
	}
}

func BadRequest(code string, message string) *ChessAPIError {
	return NewChessAPIError(http.StatusBadRequest, code, message)
}

func Unauthorized(code string, message string) *ChessAPIError {
	return NewChessAPIError(http.StatusUnauthorized, code, message)
}

func Forbidden(code string, message string) *ChessAPIError {
	return NewChessAPIError(http.StatusForbidden, code, message)
}

func NotFound(code string, message string) *ChessAPIError {
	return NewChessAPIError(http.StatusNotFound, code, message)
}

func Conflict(code string, message string) *ChessAPIError {
	return NewChessAPIError(http.StatusConflict, code, message)
}

func InternalServerError(code string, message string) *ChessAPIError {
	return NewChessAPIError(http.StatusInternalServerError, code, message)
}
