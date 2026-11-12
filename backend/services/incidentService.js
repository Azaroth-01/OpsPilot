
const { randomUUID } = require("crypto");

// Temporary in-memory incident storage.
const incidents = new Map();

// Allowed incident state transitions.
const allowedTransitions = {
    investigating: ["awaiting_approval", "investigated", "failed"],
    awaiting_approval: ["recovering", "rejected", "failed"],
    recovering: ["resolved", "failed"],
    investigated: [],
    rejected: [],
    resolved: [],
    failed: []
};

function createIncident(description) {
    if (typeof description !== "string" || !description.trim()) {
        throw new Error("Incident description is required");
    }

    const now = new Date().toISOString();

    const incident = {
        id: randomUUID(),
        description: description.trim(),
        status: "investigating",
        assessment: null,
        approvalId: null,
        recoveryResult: null,
        verification: null,
        createdAt: now,
        updatedAt: now
    };

    incidents.set(incident.id, incident);

    return structuredClone(incident);
}

function updateIncident(id, nextStatus, updates = {}) {
    const incident = incidents.get(id);

    if (!incident) {
        throw new Error("Incident not found");
    }

    const allowed = allowedTransitions[incident.status];

    if (!allowed.includes(nextStatus)) {
        throw new Error(
            `Invalid incident transition: ${incident.status} -> ${nextStatus}`
        );
    }

    incident.status = nextStatus;

    // Update additional incident information.
    Object.assign(incident, updates);

    incident.updatedAt = new Date().toISOString();

    return structuredClone(incident);
}

function getIncident(id) {
    const incident = incidents.get(id);

    if (!incident) {
        throw new Error("Incident not found");
    }

    return structuredClone(incident);
}

function getAllIncidents() {
    return Array.from(incidents.values()).map(
        incident => structuredClone(incident)
    );
}

module.exports = {
    createIncident,
    updateIncident,
    getIncident,
    getAllIncidents
};
