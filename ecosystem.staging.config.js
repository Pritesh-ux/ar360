// AR360 Studio — PM2 ecosystem for STAGING ONLY
//
// Use with: pm2 start ecosystem.staging.config.js
// Never use this file against /var/www/ar360 or process name ar360-web.

module.exports = {
  apps: [
    {
      name: "ar360-staging-web",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      node_args: "--max-old-space-size=460",
      env: {
        NODE_ENV: "production",
        AR360_DEPLOY_TARGET: "staging",
        PORT: 3001,
        HOSTNAME: "0.0.0.0",
        SKIP_RUNTIME_DDL: "true",
      },
    },
  ],
};
