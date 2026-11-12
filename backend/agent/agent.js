
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


function parseAssessment(text) {
    if (!text) {
        throw new Error("Gemini returned an empty assessment");
    }

    try {
        const assessment = JSON.parse(text);

        const requiredFields = [
            "incidentSummary",
            "affectedServices",
            "likelyRootCause",
            "supportingEvidence",
            "recommendedNextAction"
        ];

        for (const field of requiredFields) {
            if (!(field in assessment)) {
                throw new Error(`Missing assessment field: ${field}`);
            }
        }

        if (!Array.isArray(assessment.affectedServices)) {
            throw new Error("affectedServices must be an array");
        }

        if (!Array.isArray(assessment.supportingEvidence)) {
            throw new Error("supportingEvidence must be an array");
        }

        const validActionTypes = ["recovery", "investigation", "none"];

if (
    !assessment.recommendedNextAction ||
    !validActionTypes.includes(assessment.recommendedNextAction.type)
) {
    throw new Error("Invalid recommended action type");
}

const action = assessment.recommendedNextAction.action;

if (
    action !== null &&
    action !== "restart_database"
) {
    throw new Error("Unsupported recommended recovery action");
}

        return assessment;

    } catch (error) {
        throw new Error(`Invalid Gemini assessment: ${error.message}`);
    }
}


async function runIncidentAgent(incidentDescription, incidentId) {

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

Your responsibility is to investigate incidents, identify likely root causes,
and recommend appropriate recovery actions.

INVESTIGATION RULES:

1. Investigate incidents using the available diagnostic tools.
2. Examine tool results before deciding your next action.
3. Request multiple diagnostic tools when useful.
4. Never invent diagnostic results.
5. Do not recommend recovery without sufficient supporting evidence.

RECOVERY RULES:

1. You may request human approval for a recovery action using
   requestRecoveryApproval.
2. Only request approval when diagnostic evidence justifies the action.
3. Currently, the only supported recovery action is restart_database.
4. Request this action only when the database is unhealthy and the
   diagnostic evidence supports a database-related failure.
5. Do not request approval repeatedly for the same incident.
6. Requesting approval does NOT execute the recovery.
7. Never claim that an action was approved or executed merely because
   an approval request was created.
8. Never attempt to execute recovery actions yourself.
9. If no supported recovery action is justified, explain why.


FINAL RESPONSE FORMAT:

After completing the investigation and any justified approval request,
return ONLY valid JSON.

Do not use Markdown formatting or code fences.

Use this exact structure:

{
    "incidentSummary": "Brief incident summary",
    "affectedServices": [
        {
            "service": "service identifier",
            "impact": "Observed impact"
        }
    ],
    "likelyRootCause": "Likely root cause",
    "supportingEvidence": [
        {
            "source": "Diagnostic tool name",
            "finding": "Evidence returned by that tool"
        }
    ],
    "recommendedNextAction": {
        "type": "recovery, investigation, or none",
        "action": "Supported recovery action or null",
        "reason": "Reason for the recommendation"
    }
}

RESPONSE RULES:

1. Use only evidence obtained during the investigation.
2. Do not invent services, logs, measurements or observations.
3. If evidence is insufficient, state that the root cause is uncertain.
4. If no recovery is justified, do not request approval.
5. Do not include approval IDs or claim approval/execution status.
   The backend will attach actual approval information.
6. Return valid JSON only.


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
    const assessment = parseAssessment(response.text);

    const approvalObservation = observations.find(
        observation =>
            observation.tool === "requestRecoveryApproval" &&
            !observation.result.error
    );

    return {
        incidentDescription,
        observations,
        assessment,
        approvalRequest: approvalObservation
            ? approvalObservation.result
            : null
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
                result = executeTool(call.name, args,{ incidentId });
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
