
require("dotenv").config();

async function testGemini() {
    console.log("[Test] Starting Gemini test...");

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing from .env");
    }

    const { GoogleGenAI } = await import("@google/genai");

    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

    console.log("[Test] Using model:", model);
    console.log("[Test] Sending request...");

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 20000);

    try {
        const response = await ai.models.generateContent({
            model,
            contents: "Reply with exactly: Gemini connection successful.",
            config: {
                abortSignal: controller.signal,
                httpOptions: {
                    timeout: 20000
                },
                maxOutputTokens: 30
            }
        });

        console.log("[Test] Gemini responded!");
        console.log("Response:", response.text);

    } finally {
        clearTimeout(timeout);
    }
}

testGemini().catch(error => {
    console.error("[Test] Gemini failed!");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("HTTP status:", error.status || "Not provided");
});
