
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// Import routes
const agentRoutes = require("./routes/agentRoutes");

// Register routes
app.use("/api/agent", agentRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        message: "OpsPilot backend is running"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`OpsPilot server running on port ${PORT}`);
});
