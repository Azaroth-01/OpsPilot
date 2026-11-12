require("dotenv").config();

async function testGemini() {
    const { GoogleGenAI } = await import("@google/genai");

    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    try {
        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL,
            contents: "Reply with exactly: Gemini connection successful"
        });

        console.log(response.text);
    } catch (error) {
        console.error("Gemini test failed:", error.status, error.message);
    }
}

testGemini();