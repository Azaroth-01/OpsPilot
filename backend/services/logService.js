
const initialLogs = [
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
    }
];

// Current logs are independent of the baseline logs.
let logs = structuredClone(initialLogs);

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

function addLog(level, service, message) {
    const validLevels = ["INFO", "WARN", "ERROR"];
    const validServices = ["api", "database", "auth"];

    if (!validLevels.includes(level) ||
        !validServices.includes(service)) {
        throw new Error("Invalid log level or service");
    }

    logs.push({
        timestamp: new Date().toISOString(),
        level,
        service,
        message
    });
}

function resetLogs() {
    logs = structuredClone(initialLogs);
    return analyzeLogs();
}

module.exports = {
    analyzeLogs,
    addLog,
    resetLogs
};
