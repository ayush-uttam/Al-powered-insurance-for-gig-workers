import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// ─── Partner ID format rules per brand ────────────────────────
// Format: regex pattern + description shown to users
const PARTNER_FORMATS = {
  zomato:   { regex: /^ZMT-[A-Z0-9]{6,12}$/i,    example: "ZMT-AB123456",    label: "Zomato" },
  swiggy:   { regex: /^SWG-[A-Z0-9]{6,12}$/i,    example: "SWG-XY789012",    label: "Swiggy" },
  uber:     { regex: /^UB[A-Z0-9]{6,14}$/i,       example: "UBAB123456789",   label: "Uber" },
  ola:      { regex: /^OL-[A-Z0-9]{6,12}$/i,      example: "OL-CD345678",     label: "Ola" },
  dunzo:    { regex: /^DUN-[A-Z0-9]{5,10}$/i,     example: "DUN-EF5678",      label: "Dunzo" },
  blinkit:  { regex: /^BLK-[A-Z0-9]{6,12}$/i,     example: "BLK-GH901234",   label: "Blinkit" },
  zepto:    { regex: /^ZPT-[A-Z0-9]{6,12}$/i,     example: "ZPT-IJ567890",    label: "Zepto" },
  rapido:   { regex: /^RPD-[A-Z0-9]{6,12}$/i,     example: "RPD-KL123456",    label: "Rapido" },
  instamart:{ regex: /^INS-[A-Z0-9]{6,12}$/i,     example: "INS-MN789012",    label: "Swiggy Instamart" },
  other:    { regex: /^[A-Z0-9_-]{4,20}$/i,       example: "PARTNER-123",     label: "Other" },
};

// Driving license: Indian format — e.g. MH1220230012345
const LICENSE_REGEX = /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/i;

// ──────────────────────────────────────────────────────────────
// GET /worker/profile/:userId
// Returns the worker's full profile
// ──────────────────────────────────────────────────────────────
router.get("/profile/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== "admin" && req.user.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { data, error } = await supabase
      .from("worker_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ profile: data ?? null });
  } catch (err) {
    console.error("Get profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /worker/profile
// Creates or updates the gig worker's extended profile
// Body: { userId, jobType, platform, partnerBrand, partnerId,
//         averageIncome, location, city, state, address,
//         vehicleType?, licenseNumber?, yearsExperience? }
// ──────────────────────────────────────────────────────────────
router.post("/profile", authenticate, async (req, res) => {
  try {
    const {
      userId,
      jobType,
      platform,
      partnerBrand,    // brand key: "zomato", "swiggy", etc.
      partnerId,       // company-issued partner ID
      averageIncome,
      location,        // broad location string (e.g. "Mumbai")
      city,
      state,
      address,         // street address
      vehicleType,
      licenseNumber,
      yearsExperience,
    } = req.body;

    if (req.user.role !== "admin" && req.user.userId !== userId) {
      return res.status(403).json({ error: "Forbidden: cannot modify another user's profile" });
    }

    // ── Required field validation ─────────────────────────────
    const missing = [];
    if (!userId)        missing.push("userId");
    if (!jobType)       missing.push("jobType");
    if (!partnerBrand)  missing.push("partnerBrand");
    if (!partnerId)     missing.push("partnerId");
    if (!averageIncome) missing.push("averageIncome");
    if (!location)      missing.push("location");
    if (!address)       missing.push("address");

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // ── Partner ID format validation ──────────────────────────
    const brandKey = partnerBrand.toLowerCase();
    const brandRule = PARTNER_FORMATS[brandKey] ?? PARTNER_FORMATS.other;

    if (!brandRule.regex.test(partnerId.trim())) {
      return res.status(400).json({
        error: `Invalid Partner ID format for ${brandRule.label}. Expected format: ${brandRule.example}`,
        field: "partnerId",
      });
    }

    // ── Driving license validation (Indian format) ────────────
    let licenseVerified = false;
    if (licenseNumber) {
      const cleanLicense = licenseNumber.replace(/[-\s]/g, "").toUpperCase();
      if (!LICENSE_REGEX.test(cleanLicense)) {
        return res.status(400).json({
          error: "Invalid driving license format. Expected Indian format e.g. MH1220230012345",
          field: "licenseNumber",
        });
      }
      licenseVerified = true; // In production: cross-verify with Sarathi/Parivahan API
    }

    // ── Build profile payload ─────────────────────────────────
    const profilePayload = {
      user_id:          userId,
      job_type:         jobType,
      platform:         partnerBrand.charAt(0).toUpperCase() + partnerBrand.slice(1),
      partner_brand:    brandKey,
      partner_id:       partnerId.trim().toUpperCase(),
      average_income:   Number(averageIncome),
      location,
      city:             city ?? null,
      state:            state ?? null,
      address:          address ?? null,
      vehicle_type:     vehicleType ?? null,
      license_number:   licenseNumber ? licenseNumber.replace(/[-\s]/g,"").toUpperCase() : null,
      license_verified: licenseVerified,
      years_experience: yearsExperience ?? 0,
      is_verified:      true,   // Partner ID passed format check
      updated_at:       new Date().toISOString(),
    };

    // ── Ensure public.users row exists (defensive — fixes FK constraint) ─
    // This handles accounts where the users row was not created during signup
    const authUser = await supabase.auth.admin.getUserById(userId);
    if (authUser.data?.user) {
      const au = authUser.data.user;
      await supabase.from("users").upsert(
        {
          id:    userId,
          name:  au.user_metadata?.full_name ?? "Gig Worker",
          email: au.email,
          role:  au.user_metadata?.role ?? "worker",
        },
        { onConflict: "id", ignoreDuplicates: false }
      );
    }

    // ── Upsert on user_id conflict ────────────────────────────
    const { data, error } = await supabase
      .from("worker_profiles")
      .upsert(profilePayload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // ── Kick off AI analysis (fire-and-forget) ────────────────
    // Runs risk profiling + income loss + premium calc in background
    let aiAnalysis = null;
    try {
      const aiRes = await fetch(`http://localhost:${process.env.PORT || 5000}/ai/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": req.headers.authorization,
        },
        body: JSON.stringify({
          userId,
          city:            city ?? location,
          jobType,
          vehicleType:     vehicleType ?? "motorcycle",
          averageIncome:   Number(averageIncome),
          yearsExperience: Number(yearsExperience) || 0,
          licenseVerified,
          pricingMode:     "weekly",
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        aiAnalysis = aiData.analysis;
      }
    } catch (aiErr) {
      console.warn("⚠️  AI analyze background call failed:", aiErr.message);
    }

    return res.status(201).json({
      message: "Worker profile saved and verified",
      profile: data,
      verified: true,
      partnerBrand: brandRule.label,
      licenseVerified,
      aiAnalysis,   // null if AI service not available
    });
  } catch (err) {
    console.error("Worker profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
