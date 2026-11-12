
const { checkServiceHealth } = require("../services/healthService");
const { analyzeLogs } = require("../services/logService");
const { createApproval } = require("../services/approvalService");

// 1. Descriptions sent to Gemini
const toolDeclarations = [
    {
        name: "checkServiceHealth",
        description:
            "Checks the current health and response time of all application services.",
        parametersJsonSchema: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "analyzeLogs",
        description:
            "Retrieves application logs. Can optionally filter by severity and service.",
        parametersJsonSchema: {
            type: "object",
            properties: {
                level: {
                    type: "string",
                    enum: ["INFO", "WARN", "ERROR"],
                    description: "Log severity to filter by."
                },
                service: {
                    type: "string",
                    enum: ["api", "database", "auth"],
                    description: "Service whose logs should be retrieved."
                }
            }
        }
    },
    {
    name: "requestRecoveryApproval",
    description:
        "Requests human approval for a predefined recovery action. This only creates a pending approval request. It does NOT execute the recovery action.",
    parametersJsonSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["restart_database"],
                description: "The recovery action requiring human approval."
            }
        },
        required: ["action"]
    }
}

];

// 2. Actual functions our backend can execute
const toolHandlers = {
    checkServiceHealth: () => checkServiceHealth(),

    analyzeLogs: (args = {}) =>
        analyzeLogs(args.level, args.service),

    requestRecoveryApproval: (args = {}, context = {}) => {
    if (!context.incidentId) {
        throw new Error("Incident ID is required to request recovery approval");
    }

    return createApproval(args.action, context.incidentId);
}

};

// 3. Controlled execution
function executeTool(name, args = {}, context = {}) {
    const handler = toolHandlers[name];

    if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
    }

    return handler(args, context);
}

module.exports = {
    toolDeclarations,
    executeTool
};
