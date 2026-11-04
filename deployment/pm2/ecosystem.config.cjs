// Self-hosted alternative (VPS) process manager config:  pm2 start deployment/pm2/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'ananth-api',
      cwd: './backend',
      script: 'dist/server.js',
      node_args: '--env-file=.env',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      kill_timeout: 15000, // matches the API's graceful-shutdown window
      env: { NODE_ENV: 'production', TRUST_PROXY: '1' },
    },
  ],
};
