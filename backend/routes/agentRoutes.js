const {
    triggerIncident
} = require("../services/incidentSimulationService");

const {
    createIncident,
    updateIncident,
    getIncident,
    getAllIncidents
} = require("../services/incidentService");

const {
    createApproval,
    approveAction,
    rejectAction,
    markExecuted,
    markFailed,
    getApproval
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

    // Create an incident before starting the investigation.
    const incident = createIncident(incidentDescription);

    try {
        // Pass the backend-generated incident ID to the agent.
        const result = await runIncidentAgent(
            incidentDescription,
            incident.id
        );

        // Determine the incident's next lifecycle state.
        const nextStatus = result.approvalRequest
            ? "awaiting_approval"
            : "investigated";

        // Save the assessment and associated approval ID.
        const updatedIncident = updateIncident(
            incident.id,
            nextStatus,
            {
                assessment: result.assessment,
                approvalId: result.approvalRequest?.id ?? null
            }
        );

        return res.status(200).json({
            ...result,
            incident: updatedIncident
        });

    } catch (error) {
        console.error("[OpsPilot] Investigation failed:", error);

        try {
            updateIncident(incident.id, "failed");
        } catch (updateError) {
            console.error(
                "[OpsPilot] Failed to update incident status:",
                updateError.message
            );
        }

        return res.status(500).json({
            error: "Incident investigation failed",
            incidentId: incident.id
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
    let actionExecuted = false;

    try {
        // Step 1: Verify that the request exists and is pending.
        approval = approveAction(req.params.id);

        // Step 2: Move the associated incident into recovery.
        if (approval.incidentId) {
            updateIncident(approval.incidentId, "recovering");
        }

        // Step 3: Execute the approved recovery action.
        let recoveryResult;

        if (approval.action === "restart_database") {
            recoveryResult = restartDatabaseService();
        } else {
            throw new Error("Unsupported recovery action");
        }

        // Step 4: Record that the recovery action was executed.
        const updatedApproval = markExecuted(approval.id);
        actionExecuted = true;

        // Step 5: Verify the resulting service health.
        const health = checkServiceHealth();

        const databaseHealthy =
            health.services?.database?.status === "healthy";

        // Step 6: Update the associated incident.
        let updatedIncident = null;

        if (approval.incidentId) {
            updatedIncident = updateIncident(
                approval.incidentId,
                databaseHealthy ? "resolved" : "failed",
                {
                    recoveryResult,
                    verification: {
                        checkedAt: health.checkedAt,
                        databaseStatus:
                            health.services?.database?.status ?? "unknown",
                        healthy: databaseHealthy
                    }
                }
            );
        }

        return res.status(200).json({
            message: databaseHealthy
                ? "Recovery executed and verified successfully"
                : "Recovery executed, but database health verification failed",
            approval: updatedApproval,
            recovery: recoveryResult,
            health,
            incident: updatedIncident
        });

    } catch (error) {

        // Mark the approval failed only if execution was not recorded.
        if (approval && !actionExecuted) {
            try {
                markFailed(approval.id);
            } catch (statusError) {
                console.error(
                    "[Approval] Could not update failed status:",
                    statusError.message
                );
            }
        }

        // Mark the associated incident as failed if it is still active.
        if (approval?.incidentId) {
            try {
                const incident = getIncident(approval.incidentId);

                if (
                    incident.status === "awaiting_approval" ||
                    incident.status === "recovering"
                ) {
                    updateIncident(approval.incidentId, "failed");
                }
            } catch (statusError) {
                console.error(
                    "[Incident] Could not update failed status:",
                    statusError.message
                );
            }
        }

        console.error("[Approval] Recovery failed:", error);

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
