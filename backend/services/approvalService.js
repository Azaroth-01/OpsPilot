
const { randomUUID } = require("crypto");

// Temporary in-memory storage.
const approvals = new Map();

// Only predefined recovery actions are permitted.
const allowedActions = {
    restart_database: "database"
};

// Create a new approval request.
function createApproval(action) {

    const service = allowedActions[action];

    if (!service) {
        throw new Error("Unsupported recovery action");
    }

    const approval = {
        id: randomUUID(),
        action,
        service,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    approvals.set(approval.id, approval);

    return { ...approval };
}

// Approve a pending recovery request.
function approveAction(id) {

    const approval = approvals.get(id);

    if (!approval) {
        throw new Error("Approval request not found");
    }

    if (approval.status !== "pending") {
        throw new Error(`Cannot approve request with status: ${approval.status}`);
    }

    approval.status = "approved";
    approval.updatedAt = new Date().toISOString();

    return { ...approval };
}

// Reject a pending recovery request.
function rejectAction(id) {

    const approval = approvals.get(id);

    if (!approval) {
        throw new Error("Approval request not found");
    }

    if (approval.status !== "pending") {
        throw new Error(`Cannot reject request with status: ${approval.status}`);
    }

    approval.status = "rejected";
    approval.updatedAt = new Date().toISOString();

    return { ...approval };
}

// Mark an approved action as successfully executed.
function markExecuted(id) {

    const approval = approvals.get(id);

    if (!approval || approval.status !== "approved") {
        throw new Error("Recovery action is not approved");
    }

    approval.status = "executed";
    approval.updatedAt = new Date().toISOString();

    return { ...approval };
}

// Mark an approved action as failed.
function markFailed(id) {

    const approval = approvals.get(id);

    if (!approval || approval.status !== "approved") {
        throw new Error("Recovery action is not approved");
    }

    approval.status = "failed";
    approval.updatedAt = new Date().toISOString();

    return { ...approval };
}

// Retrieve an approval request.
function getApproval(id) {

    const approval = approvals.get(id);

    if (!approval) {
        throw new Error("Approval request not found");
    }

    return { ...approval };
}

module.exports = {
    createApproval,
    approveAction,
    rejectAction,
    markExecuted,
    markFailed,
    getApproval
};
