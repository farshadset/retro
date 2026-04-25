FROM golang:1.22-bookworm AS builder
WORKDIR /app

COPY go-server/go.mod go-server/go.sum ./
RUN go mod download

COPY go-server/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /out/chess-api .

FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=builder /out/chess-api /app/chess-api

ENV GO_CHESS_PORT=4000
EXPOSE 4000

CMD ["/app/chess-api"]
