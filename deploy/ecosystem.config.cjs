// PM2 Ecosystem Config — Ultiland Bot Dashboard
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

module.exports = {
  apps: [
    {
      name: "ultiland-api",
      script: "./artifacts/api-server/dist/index.mjs",
      cwd: require("path").resolve(__dirname, ".."),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3001",
        DATABASE_URL: process.env.DATABASE_URL,
        SESSION_SECRET: process.env.SESSION_SECRET,
      },
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
