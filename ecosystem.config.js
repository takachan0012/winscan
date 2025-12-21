module.exports = {
  apps: [
    {
      name: "winscan-frontend",
      script: "npm",
      args: "start",
      cwd: "/var/www/winscan",
      
      instances: 2, 
      exec_mode: "cluster", 
      
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        NEXT_TELEMETRY_DISABLED: 1, 
        NEXT_PUBLIC_BACKEND_API_URL: "https://ssl.winsnip.xyz",
        BACKEND_API_URL: "https://ssl2.winsnip.xyz" 
      },
      
      autorestart: true,
      watch: false,
      max_memory_restart: "2G", 
      min_uptime: "10s",
      max_restarts: 10,
      
      error_file: "/var/www/winscan/logs/error.log",
      out_file: "/var/www/winscan/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    }
  ]
};
