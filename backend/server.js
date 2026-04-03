import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes      from "./routes/auth.js";
import workerRoutes    from "./routes/worker.js";
import policyRoutes    from "./routes/policy.js";
import triggerRoutes   from "./routes/trigger.js";
import aiRoutes        from "./routes/ai.js";
import claimRoutes     from "./routes/claim.js";
import dashboardRoutes from "./routes/dashboard.js";
import otpRoutes       from "./routes/otp.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
app.use(express.json());

// ─── Health Check ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "✅ Gig Insurance API is running",
    version: "1.0.0",
    routes: [
      "POST /auth/signup",
      "POST /auth/login",
      "POST /worker/profile",
      "POST /policy/create",
      "POST /trigger/check",
      "POST /ai/risk-score",
      "POST /ai/fraud-check",
      "POST /claim/create",
      "GET  /dashboard/:userId",
    ],
  });
});

// ─── API Routes ────────────────────────────────────────────────
app.use("/auth",      authRoutes);
app.use("/worker",    workerRoutes);
app.use("/worker",    otpRoutes);      // POST /worker/otp/send  POST /worker/otp/verify
app.use("/policy",    policyRoutes);
app.use("/trigger",   triggerRoutes);
app.use("/ai",        aiRoutes);
app.use("/claim",     claimRoutes);
app.use("/dashboard", dashboardRoutes);

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📋 API Health: http://localhost:${PORT}/\n`);
});
