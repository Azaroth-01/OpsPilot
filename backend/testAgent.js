
require("dotenv").config();

const {
    requestToolForIncident
} = require("./agent/agent");

async function testAgent() {
    console.log("[Test] Asking Gemini to investigate incident...");

    const functionCalls = await requestToolForIncident(
        "Users are experiencing intermittent API failures."
    );

    console.log("\n[Test] Gemini returned function calls:");

    console.dir(functionCalls, { depth: null });

    if (functionCalls.length === 0) {
        console.log("[Test] No function call was returned.");
        return;
    }

    console.log("\n[Test] Function calling is working!");
}

testAgent().catch(error => {
    console.error("[Test] Agent test failed:");
    console.error(error);
});
