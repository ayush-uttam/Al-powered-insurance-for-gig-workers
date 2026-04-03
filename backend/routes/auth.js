import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../lib/supabase.js";

const router = Router();

// ──────────────────────────────────────────────────────────────
// POST /auth/signup
// Body: { name, email, password, role? }
// Creates a new user in Supabase Auth + inserts a row in `users`
// ──────────────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role = "worker" } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }

    // 1. Register with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role },
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // 2. Persist extra profile data in public.users table
    const { error: dbError } = await supabase.from("users").insert({
      id: userId,
      name,
      email,
      role,
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      // Non-fatal – Supabase Auth user is already created
      console.warn("⚠️  Could not insert into users table:", dbError.message);
    }

    // 3. Issue JWT
    const token = jwt.sign(
      { userId, email, role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Signup successful",
      token,
      user: { id: userId, name, email, role },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /auth/login
// Body: { email, password }
// Authenticates via Supabase and returns a signed JWT
// ──────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    // Authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const userId = data.user.id;
    const role = data.user.user_metadata?.role ?? "worker";
    const name = data.user.user_metadata?.full_name ?? "";

    // Ensure public.users row always exists (fixes FK constraint if signup
    // failed to insert it, or if the user was created via Supabase dashboard)
    const { error: upsertErr } = await supabase.from("users").upsert(
      { id: userId, name, email, role },
      { onConflict: "id", ignoreDuplicates: false }
    );
    if (upsertErr) console.warn("⚠️  users upsert on login:", upsertErr.message);

    // Issue our own JWT so the frontend doesn't depend on Supabase tokens
    const token = jwt.sign(
      { userId, email, role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: { id: userId, name, email, role },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
