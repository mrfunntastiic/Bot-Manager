// PM2 Ecosystem Config — Ultiland Bot Dashboard
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/

const path = require("path");

module.exports = {
  apps: [
    {
      name: "ultiland-api",
      script: "./artifacts/api-server/dist/index.mjs",
      cwd: path.resolve(__dirname, ".."),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env_file: path.resolve(__dirname, "../.env"),
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3001",
      },
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
