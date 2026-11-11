
const logs = [
    {
        timestamp: "10:01:02",
        level: "INFO",
        service: "api",
        message: "API server started"
    },
    {
        timestamp: "10:01:05",
        level: "INFO",
        service: "auth",
        message: "User authentication successful"
    },
    {
        timestamp: "10:01:08",
        level: "ERROR",
        service: "database",
        message: "Database connection failed"
    },
    {
        timestamp: "10:01:09",
        level: "ERROR",
        service: "database",
        message: "Connection pool exhausted"
    },
    {
        timestamp: "10:01:12",
        level: "WARN",
        service: "api",
        message: "Request processing delayed"
    },
    {
        timestamp: "10:01:15",
        level: "INFO",
        service: "auth",
        message: "Authentication service operational"
    }
];

function analyzeLogs(level, service) {
    let filteredLogs = logs;

    if (level) {
        filteredLogs = filteredLogs.filter(
            log => log.level === level.toUpperCase()
        );
    }

    if (service) {
        filteredLogs = filteredLogs.filter(
            log => log.service === service.toLowerCase()
        );
    }

    return {
        totalLogs: filteredLogs.length,
        filters: {
            level: level || "ALL",
            service: service || "ALL"
        },
        logs: filteredLogs
    };
}

module.exports = {
    analyzeLogs
};
