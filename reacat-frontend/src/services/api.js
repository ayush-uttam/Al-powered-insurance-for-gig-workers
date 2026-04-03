// ── Base URL ──────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ── Token helpers ─────────────────────────────────────────────
export const getToken = () => localStorage.getItem("token");
export const setToken = (t) => localStorage.setItem("token", t);
export const removeToken = () => localStorage.removeItem("token");

export const getUser = () => {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
};
export const setUser = (u) => localStorage.setItem("user", JSON.stringify(u));
export const removeUser = () => localStorage.removeItem("user");

// ── Core fetch wrapper ────────────────────────────────────────
async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

// ═════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════
export const authApi = {
  signup: (name, email, password) =>
    request("/auth/signup", { method: "POST", body: { name, email, password } }),

  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
};

// ═════════════════════════════════════════════════════════════
// WORKER
// ═════════════════════════════════════════════════════════════
export const workerApi = {
  getProfile: (userId) =>
    request(`/worker/profile/${userId}`, { auth: true }),

  saveProfile: (profile) =>
    request("/worker/profile", { method: "POST", body: profile, auth: true }),
};

// ═════════════════════════════════════════════════════════════
// OTP (License Verification)
// ═════════════════════════════════════════════════════════════
export const otpApi = {
  send: (userId, phone, licenseNumber) =>
    request("/worker/otp/send", { method: "POST", body: { userId, phone, licenseNumber }, auth: true }),

  verify: (userId, phone, otp, licenseNumber) =>
    request("/worker/otp/verify", { method: "POST", body: { userId, phone, otp, licenseNumber }, auth: true }),
};

// ═════════════════════════════════════════════════════════════
// POLICY
// ═════════════════════════════════════════════════════════════
export const policyApi = {
  create: (policy) =>
    request("/policy/create", { method: "POST", body: policy, auth: true }),
};

// ═════════════════════════════════════════════════════════════
// TRIGGER
// ═════════════════════════════════════════════════════════════
export const triggerApi = {
  check: (userId, city) =>
    request("/trigger/check", { method: "POST", body: { userId, city }, auth: true }),

  conditions: (city) =>
    request(`/trigger/conditions/${encodeURIComponent(city)}`),
};

// ═════════════════════════════════════════════════════════════
// AI
// ═════════════════════════════════════════════════════════════
export const aiApi = {
  analyze: (payload) =>
    request("/ai/analyze", { method: "POST", body: payload, auth: true }),

  getRiskScore: (payload) =>
    request("/ai/risk-score", { method: "POST", body: payload, auth: true }),

  fraudCheck: (payload) =>
    request("/ai/fraud-check", { method: "POST", body: payload, auth: true }),
};

// ═════════════════════════════════════════════════════════════
// CLAIM
// ═════════════════════════════════════════════════════════════
export const claimApi = {
  create: (claim) =>
    request("/claim/create", { method: "POST", body: claim, auth: true }),
};

// ═════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════
export const dashboardApi = {
  get: (userId) =>
    request(`/dashboard/${userId}`, { auth: true }),
};
