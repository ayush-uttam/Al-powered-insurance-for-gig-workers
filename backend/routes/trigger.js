import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// ─── Parametric trigger thresholds (from README) ──────────────
export const PARAMETRIC_THRESHOLDS = {
  rain:    { threshold: 100,  unit: "mm",    payout: 400,  label: "Heavy Rainfall"   },
  aqi:     { threshold: 400,  unit: "AQI",   payout: 300,  label: "Dangerous AQI"   },
  heat:    { threshold: 45,   unit: "°C",    payout: 350,  label: "Extreme Heat"     },
  wind:    { threshold: 60,   unit: "km/h",  payout: 250,  label: "High Wind Speed"  },
  traffic: { threshold: 80,   unit: "%",     payout: 500,  label: "Traffic Curfew"   },
};

// ─── Fetch real conditions for a city ─────────────────────────
// Uses OpenWeatherMap free tier (no API key needed for basic demo)
// Falls back to ip-api + open-meteo (all free, no auth)
async function fetchRealConditions(city = "Mumbai") {
  const conditions = {
    rain:    0,
    aqi:     0,
    heat:    0,
    wind:    0,
    traffic: 0,   // still simulated — no free real-time traffic API
    city,
    source:  "open-meteo",
    fetched_at: new Date().toISOString(),
  };

  try {
    // 1. Get lat/lon for city using open-meteo geocoding (no key needed)
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();
    const place = geoData.results?.[0];
    if (!place) throw new Error(`City not found: ${city}`);

    const { latitude: lat, longitude: lon } = place;

    // 2. Fetch weather from open-meteo (free, no key)
    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m,precipitation` +
      `&timezone=Asia%2FKolkata`
    );
    const wxData = await wxRes.json();
    const cur = wxData.current;
    if (cur) {
      conditions.heat    = parseFloat(cur.temperature_2m ?? 0);
      conditions.wind    = parseFloat(cur.wind_speed_10m ?? 0);  // km/h
      conditions.rain    = parseFloat(cur.precipitation ?? 0);   // mm (current hour)
    }

    // 3. Fetch AQI from Open AQ / World AQI API (free)
    try {
      const aqRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=Asia%2FKolkata`
      );
      const aqData = await aqRes.json();
      conditions.aqi = parseFloat(aqData.current?.us_aqi ?? 0);
    } catch { /* AQI optional */ }

    // 4. Traffic — deterministic simulation based on time of day + day of week
    const hour = new Date().getHours();
    const day  = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    const isPeak = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
    conditions.traffic = isWeekend ? 25 : isPeak ? 65 + Math.random() * 25 : 30 + Math.random() * 20;
    conditions.traffic = Math.round(conditions.traffic);

    conditions.source = "open-meteo + open-aq";
  } catch (err) {
    console.warn("⚠️  Weather fetch failed, using fallback estimates:", err.message);
    // Fallback: realistic defaults for Indian summer/monsoon
    conditions.rain    = 0;
    conditions.aqi     = 150;
    conditions.heat    = 34;
    conditions.wind    = 18;
    conditions.traffic = 45;
    conditions.source  = "fallback";
  }

  return conditions;
}

// ─── Check which parametric triggers are breached ─────────────
function evaluateTriggers(conditions) {
  const fired = [];
  for (const [key, rule] of Object.entries(PARAMETRIC_THRESHOLDS)) {
    const val = conditions[key] ?? 0;
    if (val >= rule.threshold) {
      fired.push({
        type:      key,
        label:     rule.label,
        value:     val,
        threshold: rule.threshold,
        unit:      rule.unit,
        payout:    rule.payout,
      });
    }
  }
  return fired;
}

// ──────────────────────────────────────────────────────────────
// POST /trigger/check
// Body: { userId, city? }
// Fetches real conditions, evaluates parametric thresholds,
// auto-creates claims for fired triggers.
// ──────────────────────────────────────────────────────────────
router.post("/check", authenticate, async (req, res) => {
  try {
    const { userId, city = "Mumbai" } = req.body;

    if (!userId) return res.status(400).json({ error: "userId is required" });

    if (req.user.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // 1. Fetch real-world conditions
    const conditions = await fetchRealConditions(city);

    // 2. Evaluate parametric thresholds
    const firedTriggers = evaluateTriggers(conditions);

    // 3. For each fired trigger → auto-create a claim (if user has active policy)
    const claimsCreated = [];
    for (const trigger of firedTriggers) {

      // Fetch active policy for this user
      const { data: policy } = await supabase
        .from("policies")
        .select("id, status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!policy) continue; // no active policy → skip payout

      // Avoid duplicate claim for same trigger in last 6 hours
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await supabase
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("claim_type", trigger.type)
        .gte("created_at", sixHoursAgo);

      if (recentCount > 0) continue; // already paid in last 6h

      // Insert claim
      const { data: claim } = await supabase
        .from("claims")
        .insert({
          user_id:       userId,
          policy_id:     policy.id,
          claim_type:    trigger.type,
          trigger_type:  trigger.type,
          amount:        trigger.payout,
          status:        "approved",   // parametric → auto-approved
          description:   `Auto-triggered: ${trigger.label} — ${trigger.value} ${trigger.unit} (threshold: ${trigger.threshold} ${trigger.unit})`,
          trigger_value: trigger.value,
          created_at:    new Date().toISOString(),
        })
        .select()
        .single();

      // Record trigger event
      await supabase.from("trigger_events").insert({
        user_id:      userId,
        trigger_type: trigger.type,
        outcome:      "claim_auto_triggered",
        metadata:     { value: trigger.value, threshold: trigger.threshold, city },
        policy_action:"auto_claim",
        triggered_at: new Date().toISOString(),
      });

      claimsCreated.push({ ...trigger, claimId: claim?.id });
    }

    return res.json({
      conditions,
      firedTriggers,
      claimsCreated,
      totalPayout: claimsCreated.reduce((s, c) => s + c.payout, 0),
      message: firedTriggers.length === 0
        ? "No parametric triggers breached. All conditions are safe."
        : `${firedTriggers.length} trigger(s) fired. ${claimsCreated.length} claim(s) auto-created.`,
    });
  } catch (err) {
    console.error("Trigger check error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /trigger/conditions/:city
// Public — returns current real-world conditions for a city
// ──────────────────────────────────────────────────────────────
router.get("/conditions/:city", async (req, res) => {
  try {
    const city = decodeURIComponent(req.params.city);
    const conditions = await fetchRealConditions(city);
    const firedTriggers = evaluateTriggers(conditions);
    return res.json({ conditions, firedTriggers });
  } catch (err) {
    console.error("Conditions error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
