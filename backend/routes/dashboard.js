import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// ──────────────────────────────────────────────────────────────
// GET /dashboard/:userId
// Protected – requires Bearer JWT
// Returns aggregated data for the user's dashboard:
//   • User profile
//   • Worker profile
//   • Active policies (count + list)
//   • Claims summary (count, total amount, by status)
//   • Latest AI risk score
//   • Recent trigger events (last 5)
//   • Recent fraud checks (last 5)
// ──────────────────────────────────────────────────────────────
router.get("/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow users to see their own dashboard (admins see all)
    if (req.user.role !== "admin" && req.user.userId !== userId) {
      return res.status(403).json({ error: "Forbidden: cannot access another user's dashboard" });
    }

    // ── Run all DB queries in parallel ────────────────────────
    const [
      userResult,
      workerResult,
      policiesResult,
      claimsResult,
      riskScoreResult,
      triggersResult,
      fraudResult,
    ] = await Promise.all([
      // 1. User basic info
      supabase.from("users").select("id, name, email, role, created_at").eq("id", userId).single(),

      // 2. Worker profile
      supabase
        .from("worker_profiles")
        .select("job_type, platform, average_income, location, vehicle_type, years_experience")
        .eq("user_id", userId)
        .single(),

      // 3. Policies
      supabase
        .from("policies")
        .select("id, policy_type, coverage_amount, estimated_premium, status, start_date, end_date")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),

      // 4. Claims
      supabase
        .from("claims")
        .select("id, claim_type, claim_amount, status, fraud_status, incident_date, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),

      // 5. Latest AI risk score
      supabase
        .from("ai_risk_scores")
        .select("score, risk_tier, premium_multiplier, scored_at")
        .eq("user_id", userId)
        .order("scored_at", { ascending: false })
        .limit(1)
        .single(),

      // 6. Recent trigger events
      supabase
        .from("trigger_events")
        .select("trigger_type, outcome, policy_action, triggered_at")
        .eq("user_id", userId)
        .order("triggered_at", { ascending: false })
        .limit(5),

      // 7. Recent fraud checks
      supabase
        .from("fraud_checks")
        .select("claim_id, fraud_score, fraud_risk, verdict, flags, checked_at")
        .eq("user_id", userId)
        .order("checked_at", { ascending: false })
        .limit(5),
    ]);

    // ── Build claims summary ───────────────────────────────────
    const claims = claimsResult.data ?? [];
    const claimsSummary = {
      total: claims.length,
      totalAmount: claims.reduce((sum, c) => sum + (c.claim_amount ?? 0), 0),
      byStatus: claims.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] ?? 0) + 1;
        return acc;
      }, {}),
    };

    // ── Build policies summary ────────────────────────────────
    const policies = policiesResult.data ?? [];
    const policiesSummary = {
      total: policies.length,
      active: policies.filter((p) => p.status === "active").length,
    };

    return res.json({
      user: userResult.data ?? null,
      workerProfile: workerResult.data ?? null,
      policies: {
        summary: policiesSummary,
        list: policies,
      },
      claims: {
        summary: claimsSummary,
        list: claims,
      },
      riskScore: riskScoreResult.data ?? null,
      recentTriggers: triggersResult.data ?? [],
      recentFraudChecks: fraudResult.data ?? [],
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
