
const {
    toolDeclarations,
    executeTool
} = require("./tools");

// Wait before retrying a temporary API failure.
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry only temporary Gemini API failures.
// 3 attempts = 1 initial request + 2 retries.
async function generateWithRetry(ai, request, maxAttempts = 3) {
    const retryableStatuses = [429, 500, 502, 503, 504];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await ai.models.generateContent(request);
        } catch (error) {
            const status = Number(error.status || error.code);

            if (
                !retryableStatuses.includes(status) ||
                attempt === maxAttempts
            ) {
                throw error;
            }

            const delay = 1000 * (2 ** (attempt - 1));

            console.warn(
                `[Agent] Gemini returned ${status}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`
            );

            await sleep(delay);
        }
    }
}

// Normalize arguments so equivalent objects produce the same key,
// even if their property order differs.
function normalize(value) {
    if (Array.isArray(value)) {
        return value.map(normalize);
    }

    if (value !== null && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((result, key) => {
                result[key] = normalize(value[key]);
                return result;
            }, {});
    }

    return value;
}

async function runIncidentAgent(incidentDescription) {

    const { GoogleGenAI, FunctionCallingConfigMode } =
        await import("@google/genai");

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing");
    }

    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const contents = [
        {
            role: "user",
            parts: [
                {
                    text: `Investigate this incident: ${incidentDescription}`
                }
            ]
        }
    ];

    const observations = [];

    const config = {
        systemInstruction: `
            You are OpsPilot, a DevOps incident investigation agent.

            Investigate incidents using the available diagnostic tools.

            Examine tool results before deciding your next action.
            You may request multiple tools when useful.
            Do not invent diagnostic results.
            Do not recommend recovery without sufficient evidence.

            Once you have enough evidence, provide:
            1. Incident summary
            2. Affected services
            3. Likely root cause
            4. Supporting evidence
            5. Recommended next action

            Do not execute recovery actions.
        `,

        tools: [
            {
                functionDeclarations: toolDeclarations
            }
        ],

        toolConfig: {
            functionCallingConfig: {
                mode: FunctionCallingConfigMode.AUTO
            }
        }
    };

    // Track diagnostic calls already executed in this investigation.
    const executedCalls = new Set();

    const MAX_TOOL_CALLS = 6;
    let toolCallCount = 0;

    // Initial request to Gemini.
    let response = await generateWithRetry(ai, {
        model,
        contents,
        config
    });

    // Agent loop.
    while (true) {

        const functionCalls = response.functionCalls || [];

        // Gemini has finished investigating.
        if (functionCalls.length === 0) {
            return {
                incidentDescription,
                observations,
                assessment: response.text || "No final assessment returned."
            };
        }

        console.log(
            "[Agent] Gemini requested:",
            functionCalls.map(call => call.name)
        );

        const modelContent = response.candidates?.[0]?.content;

        if (!modelContent) {
            throw new Error("Gemini response did not contain model content");
        }

        contents.push(modelContent);

        const functionResponseParts = [];

        // Execute requested tools.
        for (const call of functionCalls) {

            const args = call.args || {};

            const callKey = JSON.stringify({
                name: call.name,
                args: normalize(args)
            });

            // Prevent repeating an identical diagnostic call.
            if (executedCalls.has(callKey)) {
                console.warn(
                    `[Agent] Repeated tool call detected: ${call.name}`
                );

                return {
                    incidentDescription,
                    observations,
                    assessment:
                        `Investigation stopped because Gemini repeatedly requested ${call.name} with identical arguments.`
                };
            }

            // Enforce the tool execution limit.
            if (toolCallCount >= MAX_TOOL_CALLS) {
                return {
                    incidentDescription,
                    observations,
                    assessment:
                        "Investigation stopped because the tool-call limit was reached."
                };
            }

            executedCalls.add(callKey);

            console.log("[Agent] Executing:", call.name);

            let result;

            try {
                result = executeTool(call.name, args);
            } catch (error) {
                result = {
                    error: error.message
                };
            }

            observations.push({
                tool: call.name,
                arguments: args,
                result
            });

            toolCallCount++;

            functionResponseParts.push({
                functionResponse: {
                    name: call.name,
                    response: {
                        result
                    },
                    ...(call.id ? { id: call.id } : {})
                }
            });
        }

        contents.push({
            role: "user",
            parts: functionResponseParts
        });

        console.log("[Agent] Sending observations back to Gemini");

        // Retry only this Gemini request.
        // Previously executed tools will NOT run again.
        response = await generateWithRetry(ai, {
            model,
            contents,
            config
        });
    }
}

module.exports = {
    runIncidentAgent
};
