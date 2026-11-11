
const { checkServiceHealth } = require("../services/healthService");
const { analyzeLogs } = require("../services/logService");

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
    }
];

// 2. Actual functions our backend can execute
const toolHandlers = {
    checkServiceHealth: () => checkServiceHealth(),

    analyzeLogs: (args = {}) =>
        analyzeLogs(args.level, args.service)
};

// 3. Controlled execution
function executeTool(name, args = {}) {
    const handler = toolHandlers[name];

    if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
    }

    return handler(args);
}

module.exports = {
    toolDeclarations,
    executeTool
};
