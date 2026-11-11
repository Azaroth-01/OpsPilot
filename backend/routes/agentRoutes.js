const {
    triggerIncident
} = require("../services/incidentSimulationService");


const express = require("express");
const router = express.Router();

const { runIncidentAgent } = require("../agent/agent");

router.post("/inspect", async (req, res) => {
    const { incidentDescription } = req.body;

    if (
        typeof incidentDescription !== "string" ||
        !incidentDescription.trim()
    ) {
        return res.status(400).json({
            error: "Incident description is required"
        });
    }

    try {
        console.log("[OpsPilot] Starting investigation");

        const result = await runIncidentAgent(incidentDescription);

        console.log("[OpsPilot] Investigation completed");

        return res.status(200).json(result);

    } catch (error) {
        console.error("[OpsPilot] Agent error:", error);

        return res.status(500).json({
            error: "Incident investigation failed"
        });
    }
});


router.post("/simulate", (req, res) => {
    const { incidentType } = req.body;

    try {
        const result = triggerIncident(incidentType);

        return res.status(200).json(result);

    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
});

module.exports = router;
