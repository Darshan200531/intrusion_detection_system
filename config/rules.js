module.exports = {
    FAILED_LOGIN_THRESHOLD: 5,
    TIME_WINDOW_SECONDS: 120,

    // Log file paths
    // Linux auth log paths (choose based on your distribution):
    //   Debian/Ubuntu: /var/log/auth.log
    //   RHEL/CentOS/Fedora: /var/log/secure
    LINUX_AUTH_LOG_PATH: '/var/log/auth.log',

    // Operation mode: 'batch' (read existing file once) or 'realtime' (tail log continuously)
    MODE: 'realtime',

    // Custom log file path (used in batch mode or for testing)
    CUSTOM_LOG_PATH: './logs/auth.log'
};