import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// ─── In-memory OTP store ───────────────────────────────────────
// Map<phone, { otp, license, userId, expiresAt, attempts }>
// In production replace with Redis.
const otpStore = new Map();

const OTP_TTL_MS   = 10 * 60 * 1000;  // 10 minutes
const MAX_ATTEMPTS = 5;

// ─── Indian phone normaliser ───────────────────────────────────
function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("91")) return `+${digits.slice(1)}`;
  return null;
}

// ─── OTP generator ────────────────────────────────────────────
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── SMS sender ───────────────────────────────────────────────
async function sendSms(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE;

  if (!sid || !token || !from || sid.startsWith("ACxxx")) {
    // ── Development fallback: print to console ──────────────
    console.log(`\n${"─".repeat(50)}`);
    console.log(`📱 [DEV SMS] To: ${to}`);
    console.log(`   Message: ${body}`);
    console.log(`${"─".repeat(50)}\n`);
    return { dev: true };
  }

  // ── Production: Twilio ──────────────────────────────────────
  const twilio = (await import("twilio")).default;
  const client = twilio(sid, token);
  const msg = await client.messages.create({ body, from, to });
  return { sid: msg.sid };
}

// ──────────────────────────────────────────────────────────────
// POST /worker/otp/send
// Body: { userId, phone, licenseNumber }
// Generates 6-digit OTP and sends SMS via Twilio (or console in dev)
// ──────────────────────────────────────────────────────────────
router.post("/otp/send", authenticate, async (req, res) => {
  try {
    const { userId, phone, licenseNumber } = req.body;

    if (req.user.role !== "admin" && req.user.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!phone || !licenseNumber) {
      return res.status(400).json({ error: "phone and licenseNumber are required" });
    }

    // Validate license format
    const clean = licenseNumber.replace(/[-\s]/g, "").toUpperCase();
    if (!/^[A-Z]{2}[0-9]{13}$/.test(clean)) {
      return res.status(400).json({ error: "Invalid driving license format" });
    }

    const normPhone = normalisePhone(phone);
    if (!normPhone) {
      return res.status(400).json({ error: "Invalid Indian phone number. Enter 10-digit mobile number." });
    }

    // Rate-limit: block if existing OTP is still fresh (< 60s)
    const existing = otpStore.get(normPhone);
    if (existing && Date.now() < existing.expiresAt - (OTP_TTL_MS - 60_000)) {
      return res.status(429).json({ error: "OTP already sent. Please wait 60 seconds before requesting again." });
    }

    const otp = generateOtp();
    otpStore.set(normPhone, {
      otp,
      license:   clean,
      userId,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts:  0,
    });

    const body = `Your SafeRide AI driving license verification OTP is: ${otp}. Valid for 10 minutes. Do not share with anyone.`;
    const result = await sendSms(normPhone, body);

    return res.json({
      message:  "OTP sent successfully",
      phone:    normPhone.replace(/(\+91)(\d{2})\d{6}(\d{2})/, "$1$2xxxxxx$3"), // mask
      dev:      result.dev ?? false,
      // In dev mode expose OTP so you can test without SMS credits
      ...(result.dev ? { devOtp: otp } : {}),
    });
  } catch (err) {
    console.error("OTP send error:", err);
    return res.status(500).json({ error: err.message || "Failed to send OTP" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /worker/otp/verify
// Body: { userId, phone, otp, licenseNumber }
// Verifies OTP and marks license_verified = true in DB
// ──────────────────────────────────────────────────────────────
router.post("/otp/verify", authenticate, async (req, res) => {
  try {
    const { userId, phone, otp, licenseNumber } = req.body;

    if (req.user.role !== "admin" && req.user.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!phone || !otp || !licenseNumber) {
      return res.status(400).json({ error: "phone, otp and licenseNumber are required" });
    }

    const normPhone = normalisePhone(phone);
    if (!normPhone) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const stored = otpStore.get(normPhone);

    if (!stored) {
      return res.status(400).json({ error: "No OTP found for this number. Please request a new one." });
    }

    // Check expiry
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(normPhone);
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    // Increment attempts
    stored.attempts++;
    if (stored.attempts > MAX_ATTEMPTS) {
      otpStore.delete(normPhone);
      return res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
    }

    // Compare OTP
    if (stored.otp !== otp.toString().trim()) {
      const left = MAX_ATTEMPTS - stored.attempts;
      return res.status(400).json({
        error: `Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} remaining.`,
      });
    }

    // ✅ OTP correct — update DB
    otpStore.delete(normPhone);

    const clean = licenseNumber.replace(/[-\s]/g, "").toUpperCase();
    const { error: dbErr } = await supabase
      .from("worker_profiles")
      .update({ license_verified: true, license_number: clean, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (dbErr) {
      return res.status(500).json({ error: dbErr.message });
    }

    return res.json({
      message:         "Driving license verified successfully ✅",
      licenseVerified: true,
      license:         clean,
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    return res.status(500).json({ error: err.message || "Failed to verify OTP" });
  }
});

export default router;
