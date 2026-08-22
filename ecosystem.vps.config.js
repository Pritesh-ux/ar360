# AR360 Studio — PM2 ecosystem (full VPS install from source repo)
#
# Use this when running from the git checkout with tsx available.
# The deploy.zip package uses ecosystem.config.js (web app only).

module.exports = {
  apps: [
    {
      name: "ar360-web",
      script: "deploy/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      node_args: "--max-old-space-size=460",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
        SKIP_RUNTIME_DDL: "true",
      },
    },
    {
      name: "ar360-webhook-worker",
      script: "npx",
      args: "tsx scripts/razorpay-webhook-worker.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "256M",
      env: { NODE_ENV: "production" },
    },
    {
      name: "ar360-reconciliation-worker",
      script: "npx",
      args: "tsx scripts/razorpay-reconciliation-worker.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "256M",
      env: { NODE_ENV: "production" },
    },
    {
      name: "ar360-lifecycle-email",
      script: "node",
      args: "scripts/lifecycle-notification-loop.mjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "128M",
      env: { NODE_ENV: "production" },
    },
  ],
};
