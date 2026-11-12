const {
    triggerIncident
} = require("../services/incidentSimulationService");

const {
    createApproval,
    approveAction,
    rejectAction,
    markExecuted,
    markFailed
} = require("../services/approvalService");

const {
    restartDatabaseService
} = require("../services/recoveryService");

const {
    checkServiceHealth
} = require("../services/healthService");

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



// Create a recovery approval request.
router.post("/approvals", (req, res) => {
    try {
        const { action } = req.body;

        const approval = createApproval(action);

        return res.status(201).json({
            message: "Recovery approval request created",
            approval
        });

    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
});


// Approve and execute a recovery action.
router.post("/approvals/:id/approve", (req, res) => {
    let approval;

    try {
        // Step 1: Verify that the request exists and is pending.
        approval = approveAction(req.params.id);

        // Step 2: Execute the approved recovery action.
        let recoveryResult;

        if (approval.action === "restart_database") {
            recoveryResult = restartDatabaseService();
        } else {
            throw new Error("Unsupported recovery action");
        }

        // Step 3: Mark the action as executed.
        const updatedApproval = markExecuted(approval.id);

        // Step 4: Verify the resulting service health.
        const health = checkServiceHealth();

        return res.status(200).json({
            message: "Recovery executed successfully",
            approval: updatedApproval,
            recovery: recoveryResult,
            health
        });

    } catch (error) {

        // If execution failed after approval, record the failure.
        if (approval) {
            try {
                markFailed(approval.id);
            } catch (statusError) {
                console.error(
                    "[Approval] Could not update failed status:",
                    statusError.message
                );
            }
        }

        return res.status(400).json({
            error: error.message
        });
    }
});


// Reject a recovery request.
router.post("/approvals/:id/reject", (req, res) => {
    try {
        const approval = rejectAction(req.params.id);

        return res.status(200).json({
            message: "Recovery request rejected",
            approval
        });

    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
});

module.exports = router;
