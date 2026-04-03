import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { PARAMETRIC_THRESHOLDS } from "./trigger.js";

const router = Router();

// ══════════════════════════════════════════════════════════════
// INTERNAL AI FUNCTIONS
// Based on README: Random Forest + Gradient Boosting simulation
// ══════════════════════════════════════════════════════════════

/**
 * Step 1 — Risk Profiling
 * Simulates Random Forest classifier using weighted multi-factor scoring.
 * Factors: experience, job type, vehicle, city, income stability
 */
function computeProfileRisk({ yearsExperience=0, jobType="delivery", vehicleType="motorcycle",
  city="", averageIncome=0, accidentHistory=0, licenseVerified=false }) {

  let score = 50; // base

  // Experience reduces risk (more experience = lower risk)
  score -= Math.min(yearsExperience * 2.5, 20);

  // Job type risk modifier (README: rideshare > delivery > logistics > freelance)
  const jobRisk = { rideshare:8, delivery:4, logistics:10, freelance:-8 };
  score += jobRisk[jobType] ?? 0;

  // Vehicle type risk
  const vehRisk = { motorcycle:5, car:2, bicycle:-3, auto:4, van:6, none:-10 };
  score += vehRisk[vehicleType] ?? 0;

  // City tier risk (metro cities = more disruptions)
  const metroCities = ["mumbai","delhi","bengaluru","bangalore","chennai","hyderabad","kolkata","pune","ahmedabad"];
  const tier2 = ["surat","jaipur","lucknow","kanpur","nagpur","indore","bhopal","patna"];
  const cityLow = city.toLowerCase();
  if (metroCities.some(c => cityLow.includes(c))) score += 10;
  else if (tier2.some(c => cityLow.includes(c))) score += 5;

  // Income stability — lower income = higher financial risk
  if (averageIncome < 10000) score += 12;
  else if (averageIncome < 20000) score += 6;
  else if (averageIncome > 40000) score -= 5;

  // Accident history
  score += accidentHistory * 12;

  // License verified = trust signal
  if (licenseVerified) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Step 2 — Location/Zone Risk
 * Simulates zone-level risk based on city disruption history.
 * In production: pulled from historical weather API data per zone.
 */
function computeZoneRisk(city = "") {
  const cityLow = city.toLowerCase();

  // High disruption cities (monsoon, extreme heat, pollution)
  const highDisruption = ["mumbai","kolkata","patna","chennai","bhubaneswar","guwahati"];
  const medDisruption  = ["delhi","hyderabad","ahmedabad","surat","nagpur","jaipur","lucknow"];
  const lowDisruption  = ["bengaluru","bangalore","pune","mysore","coimbatore","chandigarh"];

  let zoneScore = 50;
  let zoneLabel = "Medium Risk";
  let seasonalRisk = "Moderate";

  if (highDisruption.some(c => cityLow.includes(c))) {
    zoneScore = 75; zoneLabel = "High Risk";
    seasonalRisk = "Heavy monsoon + AQI disruptions expected";
  } else if (medDisruption.some(c => cityLow.includes(c))) {
    zoneScore = 55; zoneLabel = "Medium Risk";
    seasonalRisk = "Seasonal heat + traffic disruptions";
  } else if (lowDisruption.some(c => cityLow.includes(c))) {
    zoneScore = 30; zoneLabel = "Low Risk";
    seasonalRisk = "Relatively stable climate zone";
  }

  // Time-of-year seasonal factor (April-June = peak heat, July-Sept = monsoon)
  const month = new Date().getMonth() + 1;
  if (month >= 4 && month <= 6) { zoneScore += 10; seasonalRisk += " · Current: peak heat season"; }
  if (month >= 7 && month <= 9) { zoneScore += 15; seasonalRisk += " · Current: peak monsoon season"; }

  return {
    zoneScore: Math.min(100, zoneScore),
    zoneLabel,
    seasonalRisk,
  };
}

/**
 * Step 3 — Income Loss Estimation
 * From README: Weekly income × impact factor per trigger
 * Rain: 40%, AQI: 25%, Heat: 30%, Curfew: 80%, Wind: 20%
 */
function estimateIncomeLoss({ weeklyIncome, zoneScore }) {
  const IMPACT_FACTORS = {
    rain:    0.40,  // 40% income loss during heavy rain
    aqi:     0.25,  // 25% during bad AQI
    heat:    0.30,  // 30% during extreme heat
    wind:    0.20,  // 20% during high winds
    traffic: 0.55,  // 55% during curfew/strike
  };

  const avgTriggersPerMonth = Math.round((zoneScore / 100) * 4); // 0–4 triggers/month
  const avgImpactFactor = Object.values(IMPACT_FACTORS).reduce((a,b)=>a+b,0) / Object.keys(IMPACT_FACTORS).length;
  const monthlyLoss = Math.round(weeklyIncome * 4 * avgTriggersPerMonth * avgImpactFactor * 0.25);
  const annualLoss  = monthlyLoss * 12;

  // Per-trigger loss breakdown
  const breakdown = {};
  for (const [type, factor] of Object.entries(IMPACT_FACTORS)) {
    breakdown[type] = {
      label: PARAMETRIC_THRESHOLDS[type]?.label ?? type,
      weeklyImpact: Math.round(weeklyIncome * factor),
      payout: PARAMETRIC_THRESHOLDS[type]?.payout ?? 0,
      coverageRatio: Math.round((PARAMETRIC_THRESHOLDS[type]?.payout / (weeklyIncome * factor)) * 100) + "%",
    };
  }

  return { monthlyLoss, annualLoss, avgTriggersPerMonth, breakdown };
}

/**
 * Step 4 — Premium Calculation
 * From README: Base Price + (Risk Score × Risk Factor)
 * Weekly subscription model aligned to gig workers' earning cycles
 */
function calculatePremium({ profileRisk, zoneRisk, weeklyIncome, pricingMode="weekly" }) {
  const BASE_WEEKLY = 20; // ₹20 minimum (README: Low Risk = ₹20/week)

  // Risk factor (README table: low=₹20, medium=₹40, high=₹60)
  const combinedRisk = Math.round((profileRisk * 0.5) + (zoneRisk * 0.5));

  let tierLabel, weeklyPremium, coverageAmount;
  if (combinedRisk <= 30) {
    tierLabel = "Low Risk";
    weeklyPremium = 20;
    coverageAmount = 300;
  } else if (combinedRisk <= 55) {
    tierLabel = "Medium Risk";
    weeklyPremium = 40;
    coverageAmount = 600;
  } else if (combinedRisk <= 75) {
    tierLabel = "High Risk";
    weeklyPremium = 60;
    coverageAmount = 900;
  } else {
    tierLabel = "Very High Risk";
    weeklyPremium = 85;
    coverageAmount = 1200;
  }

  // Income-proportional cap: premium ≤ 5% of weekly income
  const incomeCapWeekly = Math.round(weeklyIncome * 0.05);
  if (weeklyPremium > incomeCapWeekly) weeklyPremium = Math.max(BASE_WEEKLY, incomeCapWeekly);

  const monthlyPremium = Math.round(weeklyPremium * 4 * 0.8); // 20% monthly discount
  const annualPremium  = weeklyPremium * 52;
  const premium = pricingMode === "monthly" ? monthlyPremium : weeklyPremium;
  const frequency = pricingMode === "monthly" ? "monthly" : "weekly";

  return { tierLabel, weeklyPremium, monthlyPremium, annualPremium, premium, frequency, coverageAmount, combinedRisk };
}

/**
 * Step 5 — Recommended Plans
 * Based on job type + zone risk → suggest most relevant plans
 */
function recommendPlans(jobType, zoneScore) {
  const plans = {
    delivery:  ["Storm Shield", "Air Guard", "Heat Shield"],
    rideshare: ["Road Warrior", "Storm Shield", "Gig All-in-One"],
    logistics: ["Road Warrior", "Gig All-in-One", "Storm Shield"],
    freelance: ["Freelancer Pro", "Air Guard"],
  };
  const base = plans[jobType] ?? ["Air Guard"];
  if (zoneScore > 65) base.unshift("Gig All-in-One"); // high risk → suggest full coverage
  return [...new Set(base)].slice(0, 3);
}

// ══════════════════════════════════════════════════════════════
// POST /ai/analyze
// Master AI pipeline — called after location is confirmed.
// Chains: risk profiling → zone analysis → income loss estimation
//         → premium calculation → plan recommendations
// Body: { userId, city, lat?, lng?, weeklyIncome?, ... profile fields }
// ══════════════════════════════════════════════════════════════
router.post("/analyze", authenticate, async (req, res) => {
  try {
    const {
      userId,
      city        = "Mumbai",
      jobType     = "delivery",
      vehicleType = "motorcycle",
      averageIncome = 0,
      yearsExperience = 0,
      accidentHistory = 0,
      licenseVerified = false,
      pricingMode = "weekly",
    } = req.body;

    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (req.user.userId !== userId && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    const weeklyIncome = averageIncome > 0
      ? Math.round(averageIncome / 4)
      : 5000; // ₹5000/week fallback (₹20k/month)

    // ── Run AI pipeline ─────────────────────────────────────────
    const profileRisk  = computeProfileRisk({ yearsExperience, jobType, vehicleType,
                           city, averageIncome, accidentHistory, licenseVerified });
    const { zoneScore, zoneLabel, seasonalRisk } = computeZoneRisk(city);
    const incomeLoss   = estimateIncomeLoss({ weeklyIncome, zoneScore });
    const premiumCalc  = calculatePremium({ profileRisk, zoneRisk: zoneScore, weeklyIncome, pricingMode });
    const recommended  = recommendPlans(jobType, zoneScore);

    // Combined final risk score
    const finalScore = Math.round((profileRisk * 0.5) + (zoneScore * 0.5));

    // Risk tier label
    const riskTier = finalScore <= 30 ? "low" : finalScore <= 55 ? "medium" : finalScore <= 75 ? "high" : "very_high";

    const analysis = {
      userId,
      city,
      profileRisk,
      zoneRisk: { score: zoneScore, label: zoneLabel, seasonalRisk },
      finalScore,
      riskTier,
      incomeLoss,
      premium: premiumCalc,
      recommendedPlans: recommended,
      triggers: Object.entries(PARAMETRIC_THRESHOLDS).map(([key, t]) => ({
        type: key, ...t,
        description: `Pays ₹${t.payout} when ${t.label} ${key === "aqi" ? "exceeds" : "exceeds"} ${t.threshold} ${t.unit}`,
      })),
      analysisVersion: "v2.1-gradient-boost-sim",
      analyzedAt: new Date().toISOString(),
    };

    // ── Persist to ai_risk_scores ───────────────────────────────
    await supabase.from("ai_risk_scores").upsert(
      {
        user_id:          userId,
        score:            finalScore,
        risk_tier:        riskTier,
        premium_multiplier: premiumCalc.combinedRisk / 50,
        input_data:       { city, jobType, vehicleType, averageIncome, yearsExperience, licenseVerified },
        scored_at:        new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    // ── Also update worker_profiles.risk_score ──────────────────
    await supabase.from("worker_profiles")
      .update({ risk_score: finalScore, recommended_plan: recommended[0] })
      .eq("user_id", userId);

    return res.json({ success: true, analysis });
  } catch (err) {
    console.error("AI analyze error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /ai/risk-score  (kept for backward compatibility)
// ══════════════════════════════════════════════════════════════
router.post("/risk-score", authenticate, async (req, res) => {
  try {
    const { userId, yearsExperience=0, accidentHistory=0, averageHoursPerDay=8,
      vehicleAge=0, jobType="delivery", location="" } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    let score = 50;
    score -= Math.min(yearsExperience * 2, 20);
    score += accidentHistory * 10;
    if (averageHoursPerDay > 10) score += 15;
    else if (averageHoursPerDay > 8) score += 7;
    if (vehicleAge > 10) score += 10;
    else if (vehicleAge > 5) score += 5;
    const jobRisk = { rideshare:5, delivery:3, freelance:-5, logistics:8 };
    score += jobRisk[jobType] ?? 0;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const riskTier = score <= 30 ? "low" : score <= 60 ? "medium" : score <= 80 ? "high" : "very_high";
    const premiumMultiplier = score <= 30 ? 0.8 : score <= 60 ? 1.0 : score <= 80 ? 1.3 : 1.6;
    const recommendation = { low:"Eligible for discounted rates.", medium:"Standard rates apply.",
      high:"Higher premiums due to elevated risk.", very_high:"Manual underwriting review required." }[riskTier];

    await supabase.from("ai_risk_scores").upsert(
      { user_id: userId, score, risk_tier: riskTier, premium_multiplier: premiumMultiplier,
        input_data: { yearsExperience, accidentHistory, averageHoursPerDay, vehicleAge, jobType, location },
        scored_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    return res.json({ userId, score, riskTier, premiumMultiplier, recommendation });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /ai/fraud-check  (kept — same logic enhanced with GPS check)
// ══════════════════════════════════════════════════════════════
router.post("/fraud-check", authenticate, async (req, res) => {
  try {
    const { claimId, userId, claimAmount, claimType, incidentDate, description="", metadata={} } = req.body;
    if (!claimId || !userId || !claimAmount || !claimType || !incidentDate)
      return res.status(400).json({ error: "claimId, userId, claimAmount, claimType, incidentDate required" });

    let fraudScore = 0;
    const flags = [];

    if (claimAmount > 100000) { fraudScore += 30; flags.push("Unusually high claim amount"); }
    else if (claimAmount > 50000) { fraudScore += 15; flags.push("High claim amount"); }

    if (description.length < 20) { fraudScore += 15; flags.push("Insufficient incident description"); }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from("claims").select("id", { count:"exact", head:true })
      .eq("user_id", userId).gte("created_at", thirtyDaysAgo);
    if ((count ?? 0) > 3) { fraudScore += 25; flags.push(`${count} claims in last 30 days`); }

    // GPS location match check
    if (metadata.gpsCity && metadata.claimCity) {
      const gpsNorm   = metadata.gpsCity.toLowerCase().replace(/\s/g, "");
      const claimNorm = metadata.claimCity.toLowerCase().replace(/\s/g, "");
      if (!gpsNorm.includes(claimNorm) && !claimNorm.includes(gpsNorm)) {
        fraudScore += 35; flags.push(`GPS location (${metadata.gpsCity}) doesn't match claim city (${metadata.claimCity})`);
      }
    }

    fraudScore = Math.min(100, fraudScore);
    const fraudRisk = fraudScore < 25 ? "low" : fraudScore < 55 ? "medium" : "high";
    const verdict   = fraudRisk === "low" ? "approve" : fraudRisk === "medium" ? "manual_review" : "flag_for_investigation";

    const { data } = await supabase.from("fraud_checks").insert({
      claim_id: claimId, user_id: userId, fraud_score: fraudScore, fraud_risk: fraudRisk,
      verdict, flags, checked_at: new Date().toISOString(),
    }).select().single();

    return res.json({ claimId, fraudScore, fraudRisk, verdict, flags, record: data ?? null });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
