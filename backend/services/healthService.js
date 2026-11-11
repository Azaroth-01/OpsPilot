
const services = {
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

function checkServiceHealth() {
    return {
        checkedAt: new Date().toISOString(),
        services: services
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

module.exports = {
    checkServiceHealth,
    simulateServiceFailure
};
