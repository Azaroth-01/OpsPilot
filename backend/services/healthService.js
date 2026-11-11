
const initialServices = {
    api: {
        name: "API Server",
        status: "healthy",
        responseTime: 120
    },
    database: {
        name: "Database",
        status: "healthy",
        responseTime: 45
    },
    auth: {
        name: "Authentication Service",
        status: "healthy",
        responseTime: 80
    }
};

// Keep a separate copy of the current service state.
let services = structuredClone(initialServices);

function checkServiceHealth() {
    return {
        checkedAt: new Date().toISOString(),
        services: structuredClone(services)
    };
}

function simulateServiceFailure(serviceName) {
    if (!services[serviceName]) {
        throw new Error("Unknown service");
    }

    services[serviceName].status = "unhealthy";
    services[serviceName].responseTime = null;

    return checkServiceHealth();
}

function resetHealth() {
    services = structuredClone(initialServices);
    return checkServiceHealth();
}

module.exports = {
    checkServiceHealth,
    simulateServiceFailure,
    resetHealth
};
