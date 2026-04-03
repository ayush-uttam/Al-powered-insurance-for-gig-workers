import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, setToken, setUser, getToken } from "../services/api";
import "../styles/login.css";

export default function Login() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({ name: "", email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    if (getToken()) {
      navigate("/home");
      return;
    }

    const saved = localStorage.getItem("rememberedUser");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSignInData(parsed);
        setRememberMe(true);
      } catch (err) {
        console.error("Failed to parse remembered user");
      }
    }
  }, []);

  const handleSignInChange = (e) => {
    const { name, value } = e.target;
    setSignInData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSignUpChange = (e) => {
    const { name, value } = e.target;
    setSignUpData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  // ── Sign In ──────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    const { email, password } = signInData;

    if (!email.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(email.trim(), password.trim());
      setToken(res.token);
      setUser(res.user);
      
      if (rememberMe) {
        localStorage.setItem("rememberedUser", JSON.stringify({ email: email.trim(), password: password.trim() }));
      } else {
        localStorage.removeItem("rememberedUser");
      }
      
      navigate("/home");
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up ──────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    const { name, email, password } = signUpData;

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await authApi.signup(name.trim(), email.trim(), password.trim());
      setToken(res.token);
      setUser(res.user);
      navigate("/home");
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const googleSignUp = () => alert("Google Sign Up — coming soon!");

  return (
    <div className="login-page">
      <div className={`container ${active ? "active" : ""}`} id="container">

        {/* ── Sign Up Form ───────────────────────────────────── */}
        <div className="form-container sign-up">
          <form id="signupForm" onSubmit={handleSignUp}>
            <h1>Create Account</h1>
            <span>Use your email for registration</span>

            {error && active && (
              <p style={{ color: "#ff4d4d", fontSize: "13px", margin: "6px 0" }}>{error}</p>
            )}

            <input
              type="email"
              name="email"
              placeholder="📧 Email"
              value={signUpData.email}
              onChange={handleSignUpChange}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="🔒 Password (min 6 chars)"
              value={signUpData.password}
              onChange={handleSignUpChange}
              required
            />
            <input
              type="text"
              name="name"
              placeholder="👤 Full Name"
              value={signUpData.name}
              onChange={handleSignUpChange}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Sign Up"}
            </button>

            <p style={{ margin: "15px 0" }}>— OR —</p>

            <button type="button" className="google-btn" onClick={googleSignUp}>
              Continue with Google (Quick Secure Login)
            </button>

            <p className="mobile-toggle" style={{ display: "none" }}>
              Already have an account? <span onClick={() => { setActive(false); setError(""); }}>Sign In</span>
            </p>
          </form>
        </div>

        {/* ── Sign In Form ───────────────────────────────────── */}
        <div className="form-container sign-in">
          <form id="signinForm" onSubmit={handleSignIn}>
            <div className="title">
              <h1>Welcome to SafeRide AI</h1>
              <p style={{ fontSize: "13px", opacity: 0.7 }}>
                Real-time AI monitoring for safer journeys
              </p>
            </div>

            <h2>Sign In</h2>
            <span>Use your email and password</span>

            {error && !active && (
              <p style={{ color: "#ff4d4d", fontSize: "13px", margin: "6px 0" }}>{error}</p>
            )}

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={signInData.email}
              onChange={handleSignInChange}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={signInData.password}
              onChange={handleSignInChange}
              required
            />

            <label style={{ fontSize: "12px", marginTop: "5px" }}>
              <input 
                type="checkbox" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
              /> Remember Me
            </label>

            <a href="#">Forgot Your Password?</a>

            <button type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>

            <p style={{ fontSize: "12px", marginTop: "10px" }}>
              🔍 AI monitors your ride in real-time for safety
            </p>

            <p className="mobile-toggle" style={{ display: "none" }}>
              Don't have an account? <span onClick={() => { setActive(true); setError(""); }}>Sign Up</span>
            </p>
          </form>
        </div>

        {/* ── Sliding Toggle Panel ───────────────────────────── */}
        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1>Welcome to SafeRide AI</h1>
              <p>AI-powered safety for smarter rides 🚗</p>
              <button type="button" className="hidden" onClick={() => { setActive(false); setError(""); }}>
                Sign In
              </button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1>Join SafeRide AI 🚗</h1>
              <p>Create an account to experience AI-powered ride safety</p>
              <p style={{ fontSize: "12px", marginTop: "10px", opacity: 0.8 }}>
                🤖 Smart alerts • 📍 Live tracking • 🚨 Emergency detection
              </p>
              <button type="button" className="hidden" onClick={() => { setActive(true); setError(""); }}>
                Sign Up
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}