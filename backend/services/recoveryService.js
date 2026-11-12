
const { restoreService } = require("./healthService");

function restartDatabaseService() {

    console.log("[Recovery] Restarting simulated database service");

    restoreService("database");

    return {
        action: "restart_database",
        service: "database",
        status: "completed",
        message: "Simulated database restart completed.",
        completedAt: new Date().toISOString()
    };
}

module.exports = {
    restartDatabaseService
};
