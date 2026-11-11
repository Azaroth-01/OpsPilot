

const {
    toolDeclarations,
    executeTool
} = require("./tools");

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

    // Conversation history starts with the incident.
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

    // Initial request to Gemini
    let response = await ai.models.generateContent({
        model,
        contents,
        config
    });

    const MAX_TOOL_CALLS = 6;
    let toolCallCount = 0;

    // Agent loop
    while (true) {
        const functionCalls = response.functionCalls || [];

        // No more tool requests: Gemini has finished investigating.
        if (functionCalls.length === 0) {
            return {
                incidentDescription,
                observations,
                assessment: response.text || "No final assessment returned."
            };
        }

        // Safety limit
        if (toolCallCount + functionCalls.length > MAX_TOOL_CALLS) {
            return {
                incidentDescription,
                observations,
                assessment:
                    "Investigation stopped because the tool-call limit was reached."
            };
        }

        console.log("[Agent] Gemini requested:", functionCalls.map(c => c.name));

        // Preserve Gemini's original model response.
        const modelContent = response.candidates?.[0]?.content;

        if (!modelContent) {
            throw new Error("Gemini response did not contain model content");
        }

        contents.push(modelContent);

        const functionResponseParts = [];

        // Execute each requested tool.
        for (const call of functionCalls) {
            console.log("[Agent] Executing:", call.name);

            let result;

            try {
                result = executeTool(call.name, call.args || {});
            } catch (error) {
                result = {
                    error: error.message
                };
            }

            observations.push({
                tool: call.name,
                arguments: call.args || {},
                result
            });

            toolCallCount++;

            // Send tool result back to Gemini.
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

        // Gemini gets another opportunity to reason.
        response = await ai.models.generateContent({
            model,
            contents,
            config
        });
    }
}

module.exports = {
    runIncidentAgent
};
