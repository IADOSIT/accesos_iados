// ═══════════════════════════════════════════════════════════════════
//  iaDoS — PM2 Ecosystem Config
//  Ubicación en VPS: /opt/iados/ecosystem.config.js
//  Uso:  pm2 start /opt/iados/ecosystem.config.js
//        pm2 save
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  apps: [
    // ── Backend Node.js :3001 ────────────────────────────────────
    {
      name: 'iados-backend',
      script: 'src/index.js',
      cwd: '/opt/iados/backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/opt/iados/logs/backend-error.log',
      out_file: '/opt/iados/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Frontend Next.js :3002 ───────────────────────────────────
    {
      name: 'iados-frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      cwd: '/opt/iados/frontend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      error_file: '/opt/iados/logs/frontend-error.log',
      out_file: '/opt/iados/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Flutter Web estático :4000 ───────────────────────────────
    {
      name: 'iados-flutter',
      script: '/usr/local/bin/serve',
      args: '-s /opt/iados/flutter-web -l 4000 --no-clipboard',
      cwd: '/opt/iados',
      interpreter: 'none',
      watch: false,
      max_memory_restart: '150M',
      error_file: '/opt/iados/logs/flutter-error.log',
      out_file: '/opt/iados/logs/flutter-out.log',
    },
  ],
};
