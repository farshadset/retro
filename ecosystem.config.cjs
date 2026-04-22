module.exports = {
  apps: [
    {
      name: 'realtime-chess',
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
        WEB_CONCURRENCY: '1',
        CHESS_STORE_MODE: 'memory',
        CHESS_ENFORCE_SINGLE_INSTANCE: 'true',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        WEB_CONCURRENCY: '1',
        CHESS_STORE_MODE: 'memory',
        CHESS_ENFORCE_SINGLE_INSTANCE: 'true',
      },
    },
  ],
}
