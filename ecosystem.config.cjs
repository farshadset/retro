module.exports = {
  apps: [
    {
      name: 'realtime-chess-web',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1024M',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_CHESS_API_BASE_URL: '',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_CHESS_API_BASE_URL: '',
      },
    },
    {
      name: 'realtime-chess-api',
      script: './chess-api',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1024M',
      watch: false,
      env: {
        GO_CHESS_PORT: 4000,
        CHESS_STORE_MODE: 'memory',
        CHESS_ROOM_STORE_MAX_ROOMS: '500',
        CHESS_ROOM_STORE_TTL_MS: '21600000',
      },
      env_production: {
        GO_CHESS_PORT: 4000,
        CHESS_STORE_MODE: 'memory',
        CHESS_ROOM_STORE_MAX_ROOMS: '500',
        CHESS_ROOM_STORE_TTL_MS: '21600000',
      },
    },
  ],
}
