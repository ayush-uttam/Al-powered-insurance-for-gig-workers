import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// ──────────────────────────────────────────────────────────────
// POST /claim/create
// Protected – requires Bearer JWT
// Body: { userId, policyId, claimType, claimAmount,
//         incidentDate, description, evidenceUrls? }
// Creates a new insurance claim and triggers a fraud pre-check
// ──────────────────────────────────────────────────────────────
router.post("/create", authenticate, async (req, res) => {
  try {
    const {
      userId,
      policyId,
      claimType,      // e.g. "accident", "medical", "vehicle_damage", "income_loss"
      claimAmount,
      incidentDate,
      description,
      evidenceUrls = [], // array of uploaded file URLs
    } = req.body;

    if (req.user.role !== "admin" && req.user.userId !== userId) {
      return res.status(403).json({ error: "Forbidden: cannot file a claim for another user" });
    }

    if (!userId || !policyId || !claimType || !claimAmount || !incidentDate || !description) {
      return res.status(400).json({
        error: "userId, policyId, claimType, claimAmount, incidentDate and description are required",
      });
    }

    // 1. Verify the policy belongs to this user and is active
    const { data: policy, error: policyError } = await supabase
      .from("policies")
      .select("id, status, coverage_amount")
      .eq("id", policyId)
      .eq("user_id", userId)
      .single();

    if (policyError || !policy) {
      return res.status(404).json({ error: "Policy not found or does not belong to this user" });
    }

    if (policy.status !== "active") {
      return res.status(400).json({ error: "Cannot file a claim on an inactive policy" });
    }

    if (Number(claimAmount) > policy.coverage_amount) {
      return res.status(400).json({
        error: `Claim amount (${claimAmount}) exceeds policy coverage (${policy.coverage_amount})`,
      });
    }

    // 2. Insert the claim
    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .insert({
        user_id: userId,
        policy_id: policyId,
        claim_type: claimType,
        claim_amount: Number(claimAmount),
        incident_date: incidentDate,
        description,
        evidence_urls: evidenceUrls,
        status: "pending",             // pending → approved / rejected
        fraud_status: "not_checked",   // updated by /ai/fraud-check
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (claimError) {
      return res.status(500).json({ error: claimError.message });
    }

    return res.status(201).json({
      message: "Claim filed successfully. Pending review.",
      claim,
      nextStep: `Run POST /ai/fraud-check with claimId: "${claim.id}" to complete AI screening`,
    });
  } catch (err) {
    console.error("Claim create error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
