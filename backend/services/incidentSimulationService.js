
const {
    resetHealth,
    simulateServiceFailure,
    checkServiceHealth
} = require("./healthService");

const {
    resetLogs,
    addLog,
    analyzeLogs
} = require("./logService");

function triggerIncident(incidentType) {

    // Step 1: Reset previous simulation state.
    resetHealth();
    resetLogs();

    // Step 2: Apply the selected incident.
    switch (incidentType) {

        case "database_pool_exhaustion":

            simulateServiceFailure("database");

            addLog(
                "ERROR",
                "database",
                "Database connection failed"
            );

            addLog(
                "ERROR",
                "database",
                "Connection pool exhausted"
            );

            addLog(
                "WARN",
                "api",
                "Request processing delayed due to database connection issues"
            );

            break;

        default:
            throw new Error("Unknown incident type");
    }

    // Step 3: Return the updated simulation state.
    return {
        incidentType,
        health: checkServiceHealth(),
        logs: analyzeLogs()
    };
}

module.exports = { triggerIncident };
