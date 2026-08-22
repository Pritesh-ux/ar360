module.exports = {
  apps: [
    {
      name: "ar360-web",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      // Restart before the process balloons on a small VPS.
      max_memory_restart: "512M",
      node_args: "--max-old-space-size=460",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
        SKIP_RUNTIME_DDL: "true",
      },
    },
  ],
};
