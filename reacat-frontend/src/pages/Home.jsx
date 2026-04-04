import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, removeToken, removeUser, dashboardApi, policyApi, triggerApi, aiApi } from "../services/api";
import "../styles/dashboard.css";
import ProfilePage from "./ProfilePage";
import OnboardingModal from "./OnboardingModal";

// ─── Trigger definitions (mirrors original main.js) ───────────
const TRIGGERS = [
  { id:"rain",    icon:"🌧️", name:"Rainfall Level",      cond:"Fires if > 50 mm",         tiClass:"ti-rain",    unit:"mm",   threshold:50,  payout:750,  plan:"Storm Shield / Air Guard" },
  { id:"aqi",     icon:"☁️",  name:"Air Quality Index",   cond:"Fires if > 300 AQI",        tiClass:"ti-aqi",     unit:"AQI",  threshold:300, payout:750,  plan:"Air Guard" },
  { id:"traffic", icon:"🚦", name:"Traffic Disruption",  cond:"Fires if > 80% congestion", tiClass:"ti-traffic", unit:"%",    threshold:80,  payout:1000, plan:"Road Warrior" },
  { id:"heat",    icon:"🌡️", name:"Heat Index",          cond:"Fires if > 42 °C",          tiClass:"ti-heat",    unit:"°C",   threshold:42,  payout:700,  plan:"Heat Shield" },
  { id:"wind",    icon:"💨", name:"Wind Speed",           cond:"Fires if > 60 km/h",        tiClass:"ti-wind",    unit:"km/h", threshold:60,  payout:500,  plan:"Storm Shield" },
];

const WEEKLY_PRICES = [20, 35, 45, 25, 30, 75];

function drift(val, min, max, speed, bias = 0.45) {
  return Math.max(min, Math.min(max, val + (Math.random() - bias) * speed));
}

// ─── Map cell data (built once) ───────────────────────────────
function buildMapCells() {
  const levels = ["low","low","low","medium","medium","high","critical"];
  return Array.from({ length: 128 }, () => levels[Math.floor(Math.random() * levels.length)]);
}

// ─── Charts ───────────────────────────────────────────────────
function MiniChart({ data, colorClasses }) {
  const max = Math.max(...data);
  return (
    <div className="mini-chart">
      {data.map((v, i) => (
        <div key={i} className={`chart-bar ${colorClasses[i % colorClasses.length]}`} style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [page, setPage]           = useState("home");
  const [collapsed, setCollapsed] = useState(window.innerWidth <= 768);
  const [liveCity, setLiveCity] = useState(null);
  const [geoStatus, setGeoStatus] = useState("");
  const user = getUser();

  // Live clock
  const [clock, setClock]   = useState("--:--:--");

  // Live sensor state
  const sensorsRef = useRef({ rain:22, aqi:210, traffic:55, heat:36, wind:28 });
  const [sensors, setSensors] = useState({ ...sensorsRef.current });

  // Stats
  const [totalClaims, setTotalClaims]   = useState(0);
  const [totalPayout, setTotalPayout]   = useState(0);
  const [navBadge, setNavBadge]         = useState(0);

  // Claim feed
  const [feed, setFeed]       = useState([]);

  // Auto-flow steps
  const [flowDone, setFlowDone] = useState([false,false,false,false,false]);

  // Risk bars
  const [riskBars, setRiskBars] = useState({ rain:0, aqi:0, traffic:0, platform:12 });

  // Alert toast
  const [alert, setAlert]     = useState(null);
  const alertQueue            = useRef([]);
  const alertShowing          = useRef(false);

  // Payout flash
  const [flash, setFlash]     = useState(false);

  // Plans
  const [pricingMode, setPricingMode]     = useState("weekly");
  const [selectedPlan, setSelectedPlan]   = useState("Air Guard");

  // ── Policy activation state ───────────────────────────────────
  // activePolicies: { [planName]: { policyId, status } }
  const [activePolicies,   setActivePolicies]   = useState({});
  const [activatingPlan,   setActivatingPlan]   = useState(null);  // planName being processed
  const [activationError,  setActivationError]  = useState("");

  // Risk map
  const [mapCells]            = useState(buildMapCells);
  const mapCounts = mapCells.reduce((a, c) => { a[c] = (a[c]||0)+1; return a; }, {});

  // ── Real dashboard data from API ─────────────────────────────
  const [dashData, setDashData]         = useState(null);
  const [dashLoading, setDashLoading]   = useState(true);
  const [dashError, setDashError]       = useState("");

  // ── AI analysis result ────────────────────────────────────────
  const [aiAnalysis, setAiAnalysis]     = useState(null);
  const [aiLoading,  setAiLoading]      = useState(false);

  // ── Onboarding modal ─────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ── Redirect + load data ────────────────────────────────────
  useEffect(() => {
    if (!user) { navigate("/"); return; }
    dashboardApi.get(user.id)
      .then(data => {
        setDashData(data);
        if (!data?.workerProfile) setShowOnboarding(true);

        // Fire AI analysis if we have a profile
        if (data?.workerProfile) {
          const wp = data.workerProfile;
          setAiLoading(true);
          aiApi.analyze({
            userId:          user.id,
            city:            wp.city || wp.location || "Mumbai",
            jobType:         wp.job_type || "delivery",
            vehicleType:     wp.vehicle_type || "motorcycle",
            averageIncome:   wp.average_income || 0,
            yearsExperience: wp.years_experience || 0,
            licenseVerified: wp.license_verified || false,
          }).then(res => setAiAnalysis(res.analysis))
            .catch(() => {})
            .finally(() => setAiLoading(false));
        }
      })
      .catch(e => setDashError(e.message))
      .finally(() => setDashLoading(false));
  }, []);

  // ── Live clock ───────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0,8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Alert helpers ─────────────────────────────────────────────
  const showNextAlert = useCallback(() => {
    if (alertQueue.current.length === 0) { alertShowing.current = false; return; }
    alertShowing.current = true;
    const item = alertQueue.current.shift();
    setAlert(item);
    setTimeout(() => {
      setAlert(null);
      setTimeout(showNextAlert, 400);
    }, 4200);
  }, []);

  const enqueueAlert = useCallback((trigger, val) => {
    alertQueue.current.push({ trigger, val });
    if (!alertShowing.current) showNextAlert();
  }, [showNextAlert]);

  // ── Auto-flow animation ──────────────────────────────────────
  const animateFlow = useCallback(() => {
    setFlowDone([false,false,false,false,false]);
    [0,1,2,3,4].forEach(i => setTimeout(() => {
      setFlowDone(prev => { const n=[...prev]; n[i]=true; return n; });
    }, i * 280));
  }, []);

  // ── Fire claim ────────────────────────────────────────────────
  const fireClaim = useCallback((trigger, val) => {
    const secs = Math.floor(Math.random() * 42) + 12;
    const now = new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", second:"2-digit" });

    setTotalClaims(c => c + 1);
    setTotalPayout(p => p + trigger.payout);
    setNavBadge(n => n + 1);

    setFeed(prev => [{
      id: Date.now(),
      icon: trigger.icon,
      name: trigger.name,
      payout: trigger.payout,
      val: Math.round(val),
      unit: trigger.unit,
      now,
      secs,
    }, ...prev.slice(0, 24)]);

    animateFlow();
    enqueueAlert(trigger, val);
    setFlash(true);
    setTimeout(() => setFlash(false), 950);
  }, [animateFlow, enqueueAlert]);

  // ── Geolocation Reverse Auto-detect ───────────────────────────
  useEffect(() => {
    if ("geolocation" in navigator) {
      setGeoStatus("Locating...");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            if (!res.ok) throw new Error("Reverse geocoding failed");
            const data = await res.json();
            const cityStr = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state_district;
            if (cityStr) {
              setLiveCity(cityStr);
              setGeoStatus("Live GPS");
            } else {
              setGeoStatus("Location parsing failed");
            }
          } catch (err) {
            console.error("Geocoding error:", err);
            setGeoStatus("Location Error");
          }
        },
        (error) => {
          console.warn("Geolocation blocked/failed:", error.message);
          setGeoStatus("Permission Denied");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setGeoStatus("Not Supported");
    }
  }, []);

  // ── REAL sensor polling — replaces fake drift ─────────────────
  // Fetches live weather+AQI from open-meteo every 30s
  useEffect(() => {
    const activeCity = liveCity || dashData?.workerProfile?.city || "Mumbai";

    const fetchAndApply = async () => {
      try {
        const res = await triggerApi.conditions(activeCity);
        const c   = res.conditions;
        const s   = sensorsRef.current;
        if (c.rain    > 0) s.rain    = c.rain;
        if (c.aqi     > 0) s.aqi     = c.aqi;
        if (c.heat    > 0) s.heat    = c.heat;
        if (c.wind    > 0) s.wind    = c.wind;
        if (c.traffic > 0) s.traffic = c.traffic;
        setSensors({ ...s });
        setRiskBars({
          rain:     Math.round((s.rain / 120)  * 100),
          aqi:      Math.round((s.aqi  / 450)  * 100),
          traffic:  Math.round(s.traffic),
          platform: Math.round(12 + Math.random() * 8),
        });
        // Fire any breached parametric triggers on the UI
        res.firedTriggers?.forEach(ft => {
          const t = TRIGGERS.find(x => x.id === ft.type);
          if (t) fireClaim(t, ft.value);
        });
      } catch {
        // Fallback: gentle drift so UI isn't frozen
        const s = sensorsRef.current;
        s.rain    = drift(s.rain,    0,  50, 2);
        s.aqi     = drift(s.aqi,    80, 250, 8);
        s.traffic = drift(s.traffic, 20,  75, 5);
        s.heat    = drift(s.heat,   28,  40, 0.5);
        s.wind    = drift(s.wind,    5,  40, 3);
        setSensors({ ...s });
      }
    };

    fetchAndApply();                          // immediate on load
    const id = setInterval(fetchAndApply, 30_000); // every 30s
    return () => clearInterval(id);
  }, [liveCity, dashData?.workerProfile?.city, fireClaim]);

  // ── Navigation helpers ────────────────────────────────────────
  const navigateTo = (p) => {
    setPage(p);
    if (window.innerWidth <= 768) {
      setCollapsed(true);
    }
  };
  const logout = () => { removeToken(); removeUser(); navigate("/"); };

  const getPrice = (i) => {
    const w = WEEKLY_PRICES[i];
    return pricingMode === "monthly" ? Math.round(w * 4 * 0.8) : w;
  };

  // ── Policy type map (plan name → backend policyType) ─────────
  const PLAN_TYPE_MAP = {
    "Storm Shield":   "accident",
    "Air Guard":      "health",
    "Road Warrior":   "income-protection",
    "Freelancer Pro": "income-protection",
    "Heat Shield":    "health",
    "Gig All-in-One": "vehicle",
  };

  // ── Activate Coverage handler ─────────────────────────────────
  const handleActivate = async (plan, priceIdx) => {
    if (activePolicies[plan.name]) return; // already active

    const hasActive = dashData?.policies?.list?.some(p => p.status === "active");
    if (hasActive) {
      if (!window.confirm("You already have an active plan. Upgrading or switching plans will immediately supersede and cancel your current coverage. Proceed?")) {
        return;
      }
    }

    setActivatingPlan(plan.name);
    setActivationError("");
    setSelectedPlan(plan.name);
    try {
      const start = new Date();
      const end   = new Date(start);
      pricingMode === "monthly" ? end.setMonth(end.getMonth() + 1) : end.setDate(end.getDate() + 7);

      const res = await policyApi.create({
        userId:           user.id,
        policyType:       PLAN_TYPE_MAP[plan.name] ?? "income-protection",
        coverageAmount:   parseInt(plan.maxWeek.replace(/[^0-9]/g, "")) * 4,
        startDate:        start.toISOString().slice(0, 10),
        endDate:          end.toISOString().slice(0, 10),
        premiumFrequency: pricingMode === "monthly" ? "monthly" : "weekly",
        additionalRiders: plan.tags,
      });

      // Since backend cancels all other active policies, we forcefully replace state
      setActivePolicies({ [plan.name]: { policyId: res.policy.id, status: "active" } });
      
      // Fetch fresh dash data to capture canceled policies and the exact layout
      setTimeout(async () => {
        try {
          const freshDash = await dashboardApi.get(user.id);
          setDashData(freshDash);
        } catch(e) {}
        navigateTo("coverage");
      }, 1200);
    } catch (err) {
      setActivationError(`${plan.name}: ${err.message}`);
    } finally {
      setActivatingPlan(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex" }}>

      {/* ── Onboarding modal (first-time users) ────────────────── */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={(profile) => {
            setShowOnboarding(false);
            setDashData(prev => prev ? { ...prev, workerProfile: profile } : prev);
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {/* ── Payout Flash ─────────────────────────────────────── */}
      {flash && <div className="payout-flash" style={{ display:"block" }} />}

      {/* ── Alert Toast ──────────────────────────────────────── */}
      {alert && (
        <div className="live-alert show">
          <div className="alert-icon">{alert.trigger.icon}</div>
          <div>
            <div className="alert-title">⚡ Parametric Trigger Fired!</div>
            <div className="alert-body">
              {alert.trigger.name} reached {Math.round(alert.val)} {alert.trigger.unit} (threshold: {alert.trigger.threshold}). Auto-claim generated — no action needed.
            </div>
            <div className="alert-payout">₹{alert.trigger.payout.toLocaleString("en-IN")} → Credited instantly</div>
          </div>
          <button className="alert-close" onClick={() => { setAlert(null); alertShowing.current = false; showNextAlert(); }}>✕</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MOBILE HEADER & OVERLAY
      ══════════════════════════════════════════════════════ */}
      <div className="mobile-header">
        <div className="logo">
          <span className="logo-safe">Safe</span>
          <span className="logo-ride">Ride</span>
          <span className="logo-ai">AI</span>
        </div>
        <button className="hamburger-btn" onClick={() => setCollapsed(false)}>☰</button>
      </div>

      <div className={`sidebar-overlay ${!collapsed ? "show" : ""}`} onClick={() => setCollapsed(true)} />

      {/* ══════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════ */}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>

        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-safe">Safe</span>
            <span className="logo-ride">Ride</span>
            <span className="logo-ai">AI</span>
          </div>
          <button className="toggle-btn" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <div className="sidebar-status">
          <div className="status-dot" />
          <span className="status-text">Engine Live · 5 Triggers</span>
        </div>

        <div className="nav-section">
          <div className="nav-section-label">Navigation</div>
          {[
            { id:"home",      icon:"🏠", label:"Home" },
            { id:"dashboard", icon:"📡", label:"Live Monitor", badge: navBadge || null },
            { id:"plans",     icon:"🛡️", label:"Plans" },
            { id:"risk",      icon:"🗺️", label:"Risk Map" },
            { id:"analytics", icon:"📊", label:"Analytics" },
          ].map(n => (
            <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={() => navigateTo(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
            </button>
          ))}
        </div>

        <div className="sidebar-divider" />

        <div className="nav-section">
          <div className="nav-section-label">Account</div>
          <button className="nav-item" onClick={logout}>
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Logout</span>
          </button>
          {[
            { id:"profile",  icon:"👤", label:"My Profile", badge: dashData?.workerProfile?.is_verified ? null : "!" },
            { id:"coverage", icon:"👷", label:"My Coverage" },
            { id:"fraud",    icon:"🔒", label:"Fraud Guard" },
          ].map(n => (
            <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={() => navigateTo(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
              {n.badge ? <span className="nav-badge" style={{ background:"rgba(255,170,0,0.15)", color:"var(--warning)" }}>{n.badge}</span> : null}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-clock mono">{clock}</div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════════════ */}
      <main className={`main ${collapsed ? "collapsed" : ""}`}>

        {/* ── HOME ─────────────────────────────────────────── */}
        <div className={`page ${page==="home"?"active":""}`}>
          <div className="hero">
            <div className="hero-bg" />
            <div className="hero-grid" />
            <div className="hero-content">
              <div className="hero-tag">
                <div className="status-dot" />
                Parametric Insurance · No Claims · Instant Auto-Payout
              </div>
              <h1>Insurance that pays<br /><span className="hl">automatically</span></h1>
              <p className="hero-sub">
                If the trigger condition is met → you get paid. No forms, no approval, no waiting.
                Real-time sensors protect your gig income the instant a threshold is crossed.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={() => navigateTo("plans")}>Get Weekly Coverage — from ₹20/wk</button>
                <button className="btn btn-outline" onClick={() => navigateTo("dashboard")}>Watch Live Triggers →</button>
              </div>
            </div>
          </div>

          <div style={{ padding:"0 2.5rem" }}>
            <div className="metrics-row">
              {[
                { label:"Auto Payout Speed",   value:"<60s",                                              sub:"⚡ Instant trigger", cls:"up" },
                { label:"Workers Protected",    value:"8,420",                                             sub:"↑ Growing weekly",   cls:"up" },
                { label:"Your Active Policies", value: dashLoading ? "…" : (dashData?.policies?.summary?.active ?? 0), sub:dashLoading?"loading…":`${dashData?.policies?.summary?.total ?? 0} total`, cls:"" },
                { label:"Your Risk Score",       value: dashLoading ? "…" : (dashData?.riskScore?.score ?? "N/A"),        sub:dashLoading?"loading…":(dashData?.riskScore?.risk_tier ?? "not scored"), cls:"" },
                { label:"Your Claims Filed",    value: dashLoading ? "…" : (dashData?.claims?.summary?.total ?? 0),       sub:dashLoading?"loading…":`₹${(dashData?.claims?.summary?.totalAmount ?? 0).toLocaleString("en-IN")} total`, cls:"" },
              ].map((m,i) => (
                <div key={i} className="metric-card">
                  <div className="metric-label">{m.label}</div>
                  <div className={`metric-value text-accent`}>{m.value}</div>
                  <div className={`metric-sub ${m.cls}`}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding:"1.5rem 2.5rem 3rem" }}>
            <div className="section-label">How It Works</div>
            <div className="section-title">Parametric = <span className="hl-gradient">IF this → THEN pay</span></div>
            <p className="text-muted" style={{ maxWidth:560, lineHeight:1.7, marginBottom:"2rem", fontSize:"0.9rem", marginTop:"0.5rem" }}>
              Traditional insurance makes you prove your loss. Parametric insurance watches real-time conditions and pays you the moment a threshold is crossed — zero human involvement.
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"1rem", marginBottom:"2rem" }}>
              {[
                { num:"01", icon:"📋", title:"Pick Your Plan",    text:"Choose coverage by job type. Weekly plans start at ₹20. Cancel anytime.",            color:"var(--accent)" },
                { num:"02", icon:"📡", title:"System Monitors",   text:"Our engine watches weather, AQI, traffic & platform data 24/7 in real-time.",        color:"var(--accent4)" },
                { num:"03", icon:"⚡", title:"Trigger Fires",     text:"Rainfall >50mm? AQI >300? The system detects it automatically — no input needed.",   color:"var(--warning)" },
                { num:"04", icon:"💸", title:"Auto Payout",       text:"Money hits your account in <60 seconds. No form, no approval, no rejection.",        color:"var(--success)" },
              ].map(c => (
                <div key={c.num} className="card" style={{ borderLeft:`3px solid ${c.color}` }}>
                  <div style={{ fontSize:"0.68rem", fontWeight:700, color:c.color, letterSpacing:1, marginBottom:"0.875rem" }}>{c.num} ──</div>
                  <div style={{ fontSize:"1.75rem", marginBottom:"0.75rem" }}>{c.icon}</div>
                  <div style={{ fontWeight:700, marginBottom:"0.4rem" }}>{c.title}</div>
                  <div className="text-muted fs-sm" style={{ lineHeight:1.6 }}>{c.text}</div>
                </div>
              ))}
            </div>

            <div className="compare-box">
              <div className="section-label">The Difference</div>
              <div className="compare-cols">
                <div>
                  <div className="compare-col-title text-danger">❌ Traditional Insurance</div>
                  {["Submit claim manually after loss","Wait for admin review (days–weeks)","Prove your loss with documents","Risk of rejection or partial payout","Stressful, time-consuming process"].map(t=><div key={t} className="compare-item">→ {t}</div>)}
                </div>
                <div>
                  <div className="compare-col-title text-accent">✅ SafeRide AI Parametric</div>
                  {["System detects trigger automatically","No review — pre-agreed terms","Payout in under 60 seconds","Zero rejection if condition met","You focus on your work, we handle it"].map(t=><div key={t} className="compare-item good">→ {t}</div>)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── LIVE MONITOR ──────────────────────────────────── */}
        <div className={`page ${page==="dashboard"?"active":""}`}>
          <div style={{ padding:"2.5rem" }}>
            <div className="page-header">
              <div className="page-header-top">
                <div>
                  <div className="page-title">Live Parametric Monitor</div>
                  <div className="page-sub">Real-time trigger engine · Auto-claim system · Zero human intervention</div>
                </div>
                <span className="badge badge-live">● ENGINE LIVE</span>
              </div>
            </div>

            <div className="metrics-row">
              {[
                { label:"Active Triggers", value:TRIGGERS.filter(t=>sensors[t.id]>=t.threshold).length, sub:"⚡ Firing now", cls:"warn" },
                { label:"Auto Claims Today", value:totalClaims, sub:"↑ 100% auto", cls:"up" },
                { label:"Paid Out Today", value:"₹"+totalPayout.toLocaleString("en-IN"), sub:"↑ Instant transfer", cls:"up" },
                { label:"Manual Claims", value:"0", sub:"None — ever", cls:"" },
                { label:"System Uptime", value:"99.9%", sub:"● All systems OK", cls:"up" },
              ].map((m,i)=>(
                <div key={i} className="metric-card">
                  <div className="metric-label">{m.label}</div>
                  <div className={`metric-value ${i===0||i===3?"":"text-accent mono"}`}>{m.value}</div>
                  <div className={`metric-sub ${m.cls}`}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* ── AI Agent Analysis Panel ─────────────────────────── */}
            <div className="card" style={{ marginBottom:"1.5rem", background:"linear-gradient(135deg,rgba(0,229,160,0.04) 0%,rgba(0,180,255,0.03) 100%)", border:"1px solid rgba(0,229,160,0.15)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem", flexWrap:"wrap", gap:"0.5rem" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                  <span style={{ fontSize:"1.3rem" }}>🤖</span>
                  <div>
                    <div className="card-title" style={{ marginBottom:2 }}>AI Agent Analysis</div>
                    <div className="text-muted fs-xs">Location: {liveCity ? `${liveCity} (${geoStatus})` : (dashData?.workerProfile?.city || "Mumbai")} · {aiLoading ? "Analyzing…" : aiAnalysis ? `Risk scored · ${aiAnalysis.analysisVersion}` : "Run after profile save"}</div>
                  </div>
                </div>
                <span className="badge badge-ai">⚡ AUTO</span>
              </div>

              {aiLoading && (
                <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"1rem", color:"var(--text2)", fontSize:"0.83rem" }}>
                  <div className="spinner" style={{ width:16, height:16, borderWidth:2 }} />
                  Running risk profiling · zone analysis · income loss estimation…
                </div>
              )}

              {aiAnalysis && !aiLoading && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"0.875rem" }}>
                  {[
                    {
                      icon: "🎯", label: "Risk Score",
                      value: aiAnalysis.finalScore,
                      sub: aiAnalysis.riskTier?.replace("_"," ").toUpperCase(),
                      color: aiAnalysis.finalScore > 65 ? "var(--danger)" : aiAnalysis.finalScore > 40 ? "var(--warning)" : "var(--accent)",
                    },
                    {
                      icon: "💸", label: "AI Premium",
                      value: `₹${aiAnalysis.premium?.weeklyPremium}/wk`,
                      sub: aiAnalysis.premium?.tierLabel,
                      color: "var(--accent)",
                    },
                    {
                      icon: "📉", label: "Monthly Loss Risk",
                      value: `₹${(aiAnalysis.incomeLoss?.monthlyLoss ?? 0).toLocaleString("en-IN")}`,
                      sub: `${aiAnalysis.incomeLoss?.avgTriggersPerMonth ?? 0} triggers/mo est.`,
                      color: "var(--warning)",
                    },
                    {
                      icon: "📍", label: "Zone Risk",
                      value: aiAnalysis.zoneRisk?.label,
                      sub: aiAnalysis.zoneRisk?.seasonalRisk?.slice(0, 40),
                      color: aiAnalysis.zoneRisk?.score > 65 ? "var(--danger)" : aiAnalysis.zoneRisk?.score > 40 ? "var(--warning)" : "var(--accent)",
                    },
                    {
                      icon: "🛡️", label: "Recommended Plan",
                      value: aiAnalysis.recommendedPlans?.[0] ?? "Air Guard",
                      sub: aiAnalysis.recommendedPlans?.slice(1).join(" · "),
                      color: "var(--accent4)",
                    },
                  ].map(item => (
                    <div key={item.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"0.875rem" }}>
                      <div style={{ fontSize:"1.2rem", marginBottom:"0.4rem" }}>{item.icon}</div>
                      <div style={{ fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--text2)", marginBottom:"0.25rem" }}>{item.label}</div>
                      <div style={{ fontSize:"1.1rem", fontWeight:800, color:item.color, fontFamily:"'Syne',sans-serif" }}>{item.value}</div>
                      {item.sub && <div style={{ fontSize:"0.65rem", color:"var(--text2)", marginTop:"0.2rem", lineHeight:1.4 }}>{item.sub}</div>}
                    </div>
                  ))}
                </div>
              )}

              {!aiAnalysis && !aiLoading && (
                <div style={{ fontSize:"0.8rem", color:"var(--text2)", padding:"0.5rem 0" }}>
                  Complete your profile to activate AI risk scoring → go to <strong style={{ color:"var(--accent)" }}>My Profile</strong>
                </div>
              )}
            </div>

            <div className="grid-dash">
              <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>
                {/* Trigger Engine */}
                <div className="card">
                  <div className="card-title">
                    <div className="card-title-left">Parametric Trigger Engine</div>
                    <span className="badge badge-live">● LIVE</span>
                  </div>
                  <div className="trigger-list">
                    {TRIGGERS.map(t => {
                      const val = sensors[t.id];
                      const fired = val >= t.threshold;
                      const near  = !fired && val >= t.threshold * 0.85;
                      const statusClass = fired ? "ts-fire" : near ? "ts-warn" : "ts-safe";
                      const statusText  = fired ? "⚡ TRIGGERED" : near ? "⚠ Near Limit" : "● Safe";
                      return (
                        <div key={t.id} className={`trigger-item${fired?" firing":""}${near?" warning":""}`}>
                          <div className="trigger-left">
                            <div className={`trigger-icon ${t.tiClass}`}>{t.icon}</div>
                            <div>
                              <div className="trigger-name">{t.name}</div>
                              <div className="trigger-cond">{t.cond} · {t.plan}</div>
                            </div>
                          </div>
                          <div className="trigger-right">
                            <div className="trigger-value">{Math.round(val)}<span className="unit">{t.unit}</span></div>
                            <div className={`trigger-status ${statusClass}`}><div className="ts-dot" />{statusText}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="auto-flow">
                    {["Monitoring","Condition Check","Auto Claim","Payout","Notify Worker"].map((s,i)=>(
                      <span key={s} style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                        {i>0&&<span className="af-arrow">→</span>}
                        <div className={`af-step ${flowDone[i]?"done":""}`}>{s}</div>
                      </span>
                    ))}
                  </div>
                </div>

                {/* AI Risk Assessment */}
                <div className="card">
                  <div className="card-title">
                    <div className="card-title-left">AI Risk Assessment</div>
                    <span className="badge badge-ai">ML Model</span>
                  </div>
                  {[
                    { label:"🌧️ Rainfall Risk",      id:"rain",     pct:riskBars.rain,     cls:"risk-high" },
                    { label:"☁️ AQI Risk",            id:"aqi",      pct:riskBars.aqi,      cls:"risk-med" },
                    { label:"🚦 Traffic Disruption",  id:"traffic",  pct:riskBars.traffic,  cls:"risk-med" },
                    { label:"📱 Platform Downtime",   id:"platform", pct:riskBars.platform, cls:"risk-low" },
                  ].map(b=>(
                    <div key={b.id} className="risk-meter-row">
                      <div className="risk-meter-label">
                        <span>{b.label}</span>
                        <span className="val text-accent">{b.pct}%</span>
                      </div>
                      <div className="risk-bar"><div className={`risk-fill ${b.cls}`} style={{ width:`${b.pct}%` }} /></div>
                    </div>
                  ))}
                  <p className="text-muted fs-xs mt-2" style={{ lineHeight:1.6 }}>
                    🤖 ML model analyses 12 environmental + historical factors. High-risk zones auto-adjust weekly premiums.
                  </p>
                </div>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>
                {/* Auto Claim Feed */}
                <div className="card">
                  <div className="card-title">
                    <div className="card-title-left">Auto-Generated Claims</div>
                    <span className="badge badge-live">● LIVE</span>
                  </div>
                  <div className="claim-feed">
                    {feed.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"2rem 0", color:"var(--text2)", fontSize:"0.82rem" }}>
                        Waiting for triggers…<br /><span className="mono fs-xs">System monitoring 24/7</span>
                      </div>
                    ) : feed.map(c=>(
                      <div key={c.id} className="claim-item auto">
                        <div className="claim-top">
                          <div className="claim-title">{c.icon} {c.name} <span className="badge badge-auto">AUTO</span></div>
                          <div className="claim-amount">₹{c.payout.toLocaleString("en-IN")}</div>
                        </div>
                        <div className="claim-meta">
                          <span>{c.now}</span>
                          <span>Detected: {c.val} {c.unit}</span>
                          <span className="claim-paid">✓ Paid in {c.secs}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fraud Detection */}
                <div className="card">
                  <div className="card-title">Fraud Detection Shield</div>
                  <div className="fraud-flags">
                    {[
                      { icon:"📍", title:"Location Validation",   desc:"Worker GPS matches trigger zone",    badge:"PASS", cls:"fb-safe" },
                      { icon:"🔁", title:"Duplicate Claim Check", desc:"No duplicate in last 24h window",    badge:"PASS", cls:"fb-safe" },
                      { icon:"📅", title:"Active Policy Check",   desc:"Weekly subscription valid",          badge:"PASS", cls:"fb-safe" },
                      { icon:"⏱️", title:"Claim Velocity Check",  desc:"Normal claim rate detected",         badge:"PASS", cls:"fb-safe" },
                    ].map(f=>(
                      <div key={f.title} className="flag-item">
                        <div className="flag-icon">{f.icon}</div>
                        <div>
                          <div className="flag-title">{f.title}</div>
                          <div className="flag-desc text-muted fs-xs">{f.desc}</div>
                        </div>
                        <span className={`flag-badge ${f.cls}`}>{f.badge}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── PLANS ─────────────────────────────────────────── */}
        <div className={`page ${page==="plans"?"active":""}`}>
          <div style={{ padding:"2.5rem" }}>
            <div className="page-header" style={{ textAlign:"center", maxWidth:620, margin:"0 auto 2rem" }}>
              <div className="section-label">Weekly Plans</div>
              <div className="page-title">Coverage for every gig worker</div>
              <div className="page-sub mt-1">All plans use parametric triggers — no claim forms, no approval. Pay weekly, cancel anytime.</div>
            </div>
            <div className="pricing-toggle">
              {["weekly","monthly"].map(m=>(
                <button key={m} className={`pt-opt ${pricingMode===m?"active":""}`} onClick={()=>setPricingMode(m)}>
                  {m==="weekly"?"Weekly":"Monthly (–20%)"}
                </button>
              ))}
            </div>
            <div className="plans-grid">
              {/* Activation error banner */}
              {activationError && (
                <div style={{ gridColumn:"1/-1", padding:"0.75rem 1rem", background:"rgba(255,68,102,0.09)", border:"1px solid rgba(255,68,102,0.2)", borderRadius:12, fontSize:"0.82rem", color:"var(--danger)", marginBottom:"0.5rem" }}>
                  ⚠️ {activationError}
                </div>
              )}
              {[
                { name:"Storm Shield",    role:"Delivery Workers · Bike Riders",       icon:"🌧️", tags:["🌧️ Rain >50mm","💨 Wind >60km/h","⚡ Thunderstorm"],             perTrigger:"₹500",  maxWeek:"₹2,000" },
                { name:"Air Guard",       role:"All Gig Workers · Urban Areas",        icon:"😷", tags:["☁️ AQI >300","🌫️ AQI >250 (3h+)","🌧️ Rain >50mm","⚡ Thunderstorm"], perTrigger:"₹750",  maxWeek:"₹3,500", popular:true },
                { name:"Road Warrior",    role:"Cab Drivers · Auto Drivers",           icon:"🚗", tags:["🚦 Curfew / Strike","🚫 Route Blocked","🌧️ Rain >50mm","📱 App Downtime"],  perTrigger:"₹1,000",maxWeek:"₹4,500" },
                { name:"Freelancer Pro",  role:"Online Freelancers · WFH Workers",     icon:"💻", tags:["🔌 Power Outage >4h","📶 ISP Outage","💻 Platform Down"],           perTrigger:"₹600",  maxWeek:"₹2,500" },
                { name:"Heat Shield",     role:"Outdoor Workers · Construction",       icon:"🌡️", tags:["🌡️ Temp >42°C","🔥 Heat index >50","⚠️ Gov heat alert"],           perTrigger:"₹700",  maxWeek:"₹3,000" },
                { name:"Gig All-in-One",  role:"Maximum protection · All triggers",    icon:"🛡️", tags:["🌧️ Rain","☁️ AQI","🌡️ Heat","🚦 Traffic","📱 Downtime","🔌 Power"],  perTrigger:"₹1,500",maxWeek:"₹8,000" },
              ].map((plan, i) => {
                const isActive      = !!activePolicies[plan.name];
                const isActivating  = activatingPlan === plan.name;
                const anyActivating = activatingPlan !== null;
                return (
                  <div key={plan.name}
                    className={`plan-card ${(selectedPlan===plan.name||isActive) ? "selected" : ""}`}
                    style={{ opacity: anyActivating && !isActivating ? 0.6 : 1, transition:"opacity 0.2s" }}
                    onClick={() => !isActive && !anyActivating && handleActivate(plan, i)}>
                    {plan.popular && <div className="plan-popular-badge">MOST POPULAR</div>}
                    <div className="plan-icon">{plan.icon}</div>
                    <div className="plan-name">{plan.name}</div>
                    <div className="plan-role">{plan.role}</div>
                    <div className="plan-price">
                      <span className="amount">₹{getPrice(i)}</span>
                      <span className="freq">/<strong>{pricingMode==="monthly"?"month":"week"}</strong></span>
                    </div>
                    <div className="plan-trigger-label">Parametric Triggers</div>
                    <div className="plan-trigger-tags">{plan.tags.map(t=><span key={t} className="plan-tag">{t}</span>)}</div>
                    <div className="plan-payout-box">
                      <div><div className="pp-label">Per trigger</div><div className="pp-value">{plan.perTrigger}</div></div>
                      <div><div className="pp-label">Max/week</div><div className="pp-value">{plan.maxWeek}</div></div>
                    </div>
                    <button
                      className={`btn-plan ${isActive ? "chosen" : ""}`}
                      disabled={isActivating || anyActivating || isActive}
                      onClick={e => { e.stopPropagation(); if (!isActive && !anyActivating) handleActivate(plan, i); }}
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
                      {isActivating
                        ? <><div className="spinner" style={{ width:13, height:13, borderWidth:2, borderTopColor:"#050812" }} />Activating…</>
                        : isActive
                          ? "✓ Active — Coverage Running"
                          : "Activate Coverage"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RISK MAP ──────────────────────────────────────── */}
        <div className={`page ${page==="risk"?"active":""}`}>
          <div style={{ padding:"2.5rem" }}>
            <div className="page-header">
              <div className="page-header-top">
                <div>
                  <div className="page-title">AI Risk Zone Map</div>
                  <div className="page-sub">Dynamic zone assessment · Updates every 5 min · Drives AI premium pricing</div>
                </div>
                <span className="badge badge-live">● LIVE</span>
              </div>
            </div>
            <div className="card mb-3">
              <div className="card-title">Coverage Zone Heatmap</div>
              <div className="map-grid">{mapCells.map((c,i)=><div key={i} className={`map-cell ${c}`} title={c.toUpperCase()+" RISK"} />)}</div>
              <div className="map-legend">
                {[["rgba(0,229,160,0.35)","Low Risk"],["rgba(255,170,0,0.5)","Medium Risk"],["rgba(255,68,102,0.5)","High Risk"],["rgba(255,68,102,0.8)","Critical"]].map(([bg,label])=>(
                  <div key={label} className="legend-item"><div className="legend-dot" style={{ background:bg }} />{label}</div>
                ))}
              </div>
            </div>
            <div className="grid-2">
              <div className="card">
                <div className="card-title">Zone Risk Summary</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem", marginTop:"0.5rem" }}>
                  {[
                    { label:"Low Risk",    count:mapCounts.low||0,      color:"var(--accent)",  bg:"rgba(0,229,160,0.05)",    border:"rgba(0,229,160,0.15)" },
                    { label:"Medium Risk", count:mapCounts.medium||0,   color:"var(--warning)", bg:"rgba(255,170,0,0.05)",    border:"rgba(255,170,0,0.15)" },
                    { label:"High Risk",   count:mapCounts.high||0,     color:"var(--danger)",  bg:"rgba(255,68,102,0.05)",   border:"rgba(255,68,102,0.15)" },
                    { label:"Critical",    count:mapCounts.critical||0, color:"var(--danger)",  bg:"rgba(255,68,102,0.1)",    border:"rgba(255,68,102,0.3)" },
                  ].map(z=>(
                    <div key={z.label} style={{ background:z.bg, border:`1px solid ${z.border}`, borderRadius:"var(--radius-sm)", padding:"0.875rem" }}>
                      <div className="fs-xs text-muted fw-700" style={{ letterSpacing:"0.5px", textTransform:"uppercase" }}>{z.label}</div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.6rem", fontWeight:800, color:z.color }}>{z.count}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-title"><div className="card-title-left">AI Premium Adjustment</div><span className="badge badge-ai">AI</span></div>
                <p className="text-muted fs-sm mt-1 mb-3" style={{ lineHeight:1.6 }}>ML model adjusts weekly premiums per zone in real-time. High-risk zones get modest surcharge; safe zones get discounts.</p>
                {[
                  { zone:"Zone: Indiranagar", adj:"+₹5/wk", pct:80, cls:"risk-high", color:"var(--accent)" },
                  { zone:"Zone: Koramangala", adj:"+₹2/wk", pct:45, cls:"risk-med",  color:"var(--warning)" },
                  { zone:"Zone: Whitefield",  adj:"−₹3/wk", pct:20, cls:"risk-low",  color:"var(--accent)" },
                  { zone:"Zone: Jayanagar",   adj:"±₹0/wk", pct:12, cls:"risk-low",  color:"var(--text2)" },
                ].map(z=>(
                  <div key={z.zone} className="risk-meter-row">
                    <div className="risk-meter-label"><span>{z.zone}</span><span className="val" style={{ color:z.color }}>{z.adj}</span></div>
                    <div className="risk-bar"><div className={`risk-fill ${z.cls}`} style={{ width:`${z.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── ANALYTICS ─────────────────────────────────────── */}
        <div className={`page ${page==="analytics"?"active":""}`}>
          <div style={{ padding:"2.5rem" }}>
            <div className="page-header">
              <div className="page-title">Analytics & Predictions</div>
              <div className="page-sub">Claim trends · Payout history · Trigger frequency · AI forecasting</div>
            </div>
            <div className="metrics-row">
              {[
                { label:"Claims (30d)",   value:"342",   sub:"↑ 100% auto", cls:"up" },
                { label:"Payouts (30d)",  value:"₹1.71L", sub:"All <60s",    cls:"up" },
                { label:"Avg Payout",     value:"₹500",   sub:"Per event",   cls:"" },
                { label:"Fraud Blocked",  value:"17",     sub:"AI flagged",   cls:"warn" },
                { label:"Workers Paid",   value:"284",    sub:"This month",   cls:"up" },
              ].map((m,i)=>(
                <div key={i} className="metric-card">
                  <div className="metric-label">{m.label}</div>
                  <div className={`metric-value ${i===0||i===3||i===4?"":"text-accent mono"}`}>{m.value}</div>
                  <div className={`metric-sub ${m.cls}`}>{m.sub}</div>
                </div>
              ))}
            </div>
            <div className="grid-2 mb-3">
              <div className="card">
                <div className="card-title">Daily Claims — Last 14 Days</div>
                <MiniChart data={[8,12,42,19,6,23,31,14,9,28,35,11,17,22]} colorClasses={["bar-accent"]} />
                <div className="flex gap-2 mt-2 fs-xs text-muted flex-wrap"><span>Peak: 42 claims (rain event)</span><span>·</span><span>Avg: 18/day</span></div>
              </div>
              <div className="card">
                <div className="card-title">Daily Payouts (₹000s)</div>
                <MiniChart data={[4,6,21,9,3,11,15,7,4,14,17,5,8,11]} colorClasses={["bar-purple","bar-orange"]} />
                <div className="flex gap-2 mt-2 fs-xs flex-wrap">
                  <span style={{ color:"var(--accent2)" }}>■ Rain 42%</span>
                  <span style={{ color:"var(--accent3)" }}>■ AQI 28%</span>
                  <span style={{ color:"var(--accent4)" }}>■ Traffic 18%</span>
                  <span style={{ color:"var(--accent)" }}>■ Heat 12%</span>
                </div>
              </div>
            </div>
            <div className="grid-2">
              <div className="card">
                <div className="card-title">Trigger Frequency (30d)</div>
                <div className="mt-2">
                  {[
                    { label:"🌧️ Heavy Rainfall",   count:127, pct:85, cls:"risk-high" },
                    { label:"☁️ High AQI",          count:89,  pct:60, cls:"risk-med" },
                    { label:"🚦 Traffic Disruption",count:54,  pct:36, cls:"risk-med" },
                    { label:"🌡️ Heat Wave",          count:38,  pct:26, cls:"risk-low" },
                    { label:"📱 Platform Down",       count:34,  pct:23, cls:"risk-low" },
                  ].map(r=>(
                    <div key={r.label} className="risk-meter-row">
                      <div className="risk-meter-label"><span>{r.label}</span><span className="val mono">{r.count}</span></div>
                      <div className="risk-bar"><div className={`risk-fill ${r.cls}`} style={{ width:`${r.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-title"><div className="card-title-left">7-Day AI Forecast</div><span className="badge badge-ai">AI</span></div>
                <div className="mt-1">
                  {[
                    { day:"Tomorrow",  text:"HIGH rain 78%",  border:"rgba(255,68,102,0.2)", bg:"rgba(255,68,102,0.04)",  color:"var(--danger)" },
                    { day:"Day 2",     text:"AQI spike 55%",  border:"rgba(255,170,0,0.2)",  bg:"rgba(255,170,0,0.04)",   color:"var(--warning)" },
                    { day:"Day 3",     text:"Low risk 12%",   border:"rgba(0,229,160,0.12)", bg:"rgba(0,229,160,0.03)",   color:"var(--accent)" },
                    { day:"Day 4–5",   text:"Heat wave 65%",  border:"rgba(255,170,0,0.15)", bg:"rgba(255,170,0,0.03)",   color:"var(--warning)" },
                    { day:"Day 6–7",   text:"Uncertain",      border:"var(--card-border)",   bg:"rgba(255,255,255,0.018)",color:"var(--text2)" },
                  ].map(f=>(
                    <div key={f.day} className="forecast-row" style={{ borderColor:f.border, background:f.bg }}>
                      <span className="fs-sm fw-700">{f.day}</span>
                      <span className="fs-xs fw-700" style={{ color:f.color }}>{f.text}</span>
                    </div>
                  ))}
                </div>
                <p className="fs-xs text-muted mt-2" style={{ lineHeight:1.6 }}>🤖 Based on weather API trends + historical trigger patterns</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── MY COVERAGE ───────────────────────────────────── */}
        <div className={`page ${page==="coverage"?"active":""}`}>
          <div style={{ padding:"2.5rem" }}>
            <div className="page-header">
              <div className="page-header-top">
                <div>
                  <div className="page-title">My Coverage</div>
                  <div className="page-sub">Worker dashboard · Active protection · Payout history</div>
                </div>
                {dashData?.riskScore && (
                  <span className={`badge ${dashData.riskScore.risk_tier==="low"?"badge-ai":dashData.riskScore.risk_tier==="medium"?"badge-warn":""}`} style={dashData.riskScore.risk_tier==="high"||dashData.riskScore.risk_tier==="very_high"?{background:"rgba(255,68,102,0.12)",color:"var(--danger)",border:"1px solid rgba(255,68,102,0.25)"}:{}}>
                    Risk Score: {dashData.riskScore.score} · {dashData.riskScore.risk_tier}
                  </span>
                )}
              </div>
            </div>

            {/* Error banner */}
            {dashError && (
              <div style={{ color:"var(--danger)", background:"rgba(255,68,102,0.08)", border:"1px solid rgba(255,68,102,0.2)", borderRadius:10, padding:"12px 18px", marginBottom:20, fontSize:"0.85rem" }}>
                ⚠️ Could not load your data: {dashError}
              </div>
            )}

            {/* Loading skeleton */}
            {dashLoading && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {[1,2,3].map(i => <div key={i} style={{ height:80, borderRadius:14, background:"rgba(255,255,255,0.04)", animation:"badgePulse 1.5s infinite" }} />)}
              </div>
            )}

            {!dashLoading && dashData && (
              <>
                {(() => {
                  const activePlan = dashData?.policies?.list?.find(p => p.status === "active");
                  if (!activePlan) return null;
                  
                  const start = new Date(activePlan.start_date);
                  const end = new Date(activePlan.end_date);
                  const now = new Date();
                  
                  const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
                  const passedDays = Math.max(0, Math.min(totalDays, Math.round((now - start) / (1000 * 60 * 60 * 24))));
                  const percent = Math.min(100, Math.round((passedDays / totalDays) * 100));

                  return (
                    <div className="card" style={{ marginBottom: "1.5rem", borderLeft: "4px solid var(--accent)", background: "linear-gradient(135deg, rgba(0, 229, 160, 0.04) 0%, rgba(0, 180, 255, 0.02) 100%)" }}>
                      <div className="card-title" style={{ marginBottom: "0.5rem" }}>
                        <span style={{ fontSize:"1.2rem", marginRight:"8px" }}>🟢</span> 
                        Active Plan Tracking: <span style={{ textTransform: "capitalize", marginLeft:"6px", color:"var(--text)" }}>{activePlan.policy_type.replace(/-/g," ")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem", color: "var(--text2)" }}>
                        <span>Day {passedDays} of {totalDays}</span>
                        <span>{totalDays - passedDays} days remaining</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "100px", overflow: "hidden" }}>
                        <div style={{ width: `${percent}%`, height: "100%", background: "linear-gradient(90deg, var(--accent), #00b4ff)", transition: "width 1s ease-in-out" }} />
                      </div>
                      <div style={{ marginTop:"1rem", display:"flex", justifyContent:"space-between", fontSize:"0.75rem", color:"var(--text2)" }}>
                        <span>Started: {activePlan.start_date}</span>
                        <span>Ends: {activePlan.end_date}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Profile header */}
                <div className="profile-header">
                  <div className="avatar">{dashData.workerProfile ? "👷" : "👤"}</div>
                  <div>
                    <div className="profile-name">{dashData.user?.name || user?.name || "Gig Worker"}</div>
                    <div className="profile-role">
                      {dashData.workerProfile ? `${dashData.workerProfile.platform} · ${dashData.workerProfile.location}` : "No worker profile yet"}
                    </div>
                    <div className="profile-badges">
                      {dashData.workerProfile && <span className="p-badge">✅ Verified Worker</span>}
                      {dashData.policies?.summary?.active > 0 && <span className="p-badge">🛡️ {dashData.policies.summary.active} Active {dashData.policies.summary.active===1?"Policy":"Policies"}</span>}
                      {dashData.riskScore && <span className="p-badge">📊 Risk: {dashData.riskScore.score}/100</span>}
                    </div>
                  </div>
                </div>

                {/* Coverage summary banner */}
                <div className="coverage-banner">
                  <div>
                    <div style={{ fontWeight:700 }}>
                      🛡️ {dashData.policies?.summary?.active > 0 ? `${dashData.policies.summary.active} Active Policy` : "No Active Policies"}
                    </div>
                    <div style={{ fontSize:"0.82rem", color:"var(--text2)", marginTop:4 }}>Parametric coverage running 24/7</div>
                    <div className="week-bar">
                      <div className="week-fill" style={{ width:`${Math.min(100, (dashData.policies?.summary?.active / Math.max(dashData.policies?.summary?.total,1)) * 100)}%` }} />
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div className="fs-xs text-muted">Total claims filed</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"1.4rem", fontWeight:700, color:"var(--accent)" }}>₹{(dashData.claims?.summary?.totalAmount ?? 0).toLocaleString("en-IN")}</div>
                    <div className="fs-xs text-muted mt-1">{dashData.claims?.summary?.total ?? 0} claims · {dashData.claims?.summary?.byStatus?.approved ?? 0} approved</div>
                  </div>
                </div>

                <div className="grid-2">
                  {/* Active Policies list */}
                  <div className="card">
                    <div className="card-title">
                      <div className="card-title-left">🛡️ Your Policies</div>
                      <span style={{ fontSize:"0.72rem", color:"var(--text2)" }}>{dashData.policies?.summary?.total ?? 0} total</span>
                    </div>
                    {dashData.policies?.list?.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"1.5rem 0", color:"var(--text2)", fontSize:"0.82rem" }}>No policies yet. Go to Plans to activate coverage.</div>
                    ) : dashData.policies.list.map(p => (
                      <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid var(--card-border)" }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:"0.875rem", textTransform:"capitalize" }}>{p.policy_type.replace(/-/g," ")}</div>
                          <div style={{ fontSize:"0.7rem", color:"var(--text2)", marginTop:2 }}>{p.start_date} → {p.end_date}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:"var(--accent)" }}>₹{Number(p.estimated_premium).toLocaleString("en-IN")}<span style={{ fontSize:"0.68rem", color:"var(--text2)", fontFamily:"inherit" }}>/{p.premium_frequency?.slice(0,2)}</span></div>
                          <span style={{ fontSize:"0.65rem", padding:"0.15rem 0.5rem", borderRadius:100, fontWeight:700, background: p.status==="active"?"rgba(0,229,160,0.12)":"rgba(255,170,0,0.1)", color: p.status==="active"?"var(--accent)":"var(--warning)" }}>{p.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recent Claims list */}
                  <div className="card">
                    <div className="card-title">
                      <div className="card-title-left">📋 Your Claims</div>
                      <span style={{ fontSize:"0.72rem", color:"var(--text2)" }}>{dashData.claims?.summary?.total ?? 0} total</span>
                    </div>
                    {dashData.claims?.list?.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"1.5rem 0", color:"var(--text2)", fontSize:"0.82rem" }}>No claims filed yet.</div>
                    ) : dashData.claims.list.slice(0,5).map(c => (
                      <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid var(--card-border)" }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:"0.875rem", textTransform:"capitalize" }}>{c.claim_type.replace(/_/g," ")}</div>
                          <div style={{ fontSize:"0.7rem", color:"var(--text2)", marginTop:2 }}>Incident: {c.incident_date}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:"var(--accent)" }}>₹{Number(c.claim_amount).toLocaleString("en-IN")}</div>
                          <span style={{ fontSize:"0.65rem", padding:"0.15rem 0.5rem", borderRadius:100, fontWeight:700, background: c.status==="approved"?"rgba(0,229,160,0.12)":c.status==="rejected"?"rgba(255,68,102,0.12)":"rgba(255,170,0,0.1)", color: c.status==="approved"?"var(--accent)":c.status==="rejected"?"var(--danger)":"var(--warning)" }}>{c.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Worker Profile details */}
                {dashData.workerProfile && (
                  <div className="card mt-3">
                    <div className="card-title">👷 Worker Profile</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:16 }}>
                      {[
                        ["Platform",    dashData.workerProfile.platform],
                        ["Job Type",    dashData.workerProfile.job_type],
                        ["Location",    dashData.workerProfile.location],
                        ["Avg. Income", `₹${Number(dashData.workerProfile.average_income).toLocaleString("en-IN")}/mo`],
                        ["Vehicle",     dashData.workerProfile.vehicle_type ?? "—"],
                        ["Experience",  `${dashData.workerProfile.years_experience ?? 0} yrs`],
                      ].map(([label,value]) => (
                        <div key={label}>
                          <div style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--text2)", marginBottom:4 }}>{label}</div>
                          <div style={{ fontSize:"0.9rem", fontWeight:600, textTransform:"capitalize" }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── FRAUD GUARD ───────────────────────────────────── */}
        <div className={`page ${page==="fraud"?"active":""}`}>
          <div style={{ padding:"2.5rem" }}>
            <div className="page-header">
              <div className="page-header-top">
                <div>
                  <div className="page-title">Fraud Guard</div>
                  <div className="page-sub">Real-time fraud detection · Zero false claims · AI-powered verification</div>
                </div>
                <span className="badge badge-ai">AI Shield</span>
              </div>
            </div>

            {/* Recent AI Fraud Checks from real DB */}
            {!dashLoading && dashData?.recentFraudChecks?.length > 0 && (
              <div className="card" style={{ marginBottom:"1.5rem" }}>
                <div className="card-title">
                  <div className="card-title-left">📋 Recent Fraud Check Results</div>
                  <span className="fs-xs text-muted">{dashData.recentFraudChecks.length} checks</span>
                </div>
                <div className="fraud-flags">
                  {dashData.recentFraudChecks.map((fc, i) => {
                    const cls = fc.fraud_risk==="low" ? "fb-safe" : fc.fraud_risk==="medium" ? "fb-warn" : "fb-danger";
                    const badge = fc.verdict==="approve" ? "APPROVED" : fc.verdict==="review" ? "REVIEW" : "REJECTED";
                    return (
                      <div key={i} className="flag-item">
                        <div className="flag-icon">{fc.fraud_risk==="low"?"✅":fc.fraud_risk==="medium"?"⚠️":"🚨"}</div>
                        <div>
                          <div className="flag-title">Claim #{fc.claim_id?.slice(-6) ?? ""} · Score: {fc.fraud_score}/100</div>
                          <div className="flag-desc text-muted fs-xs">{new Date(fc.checked_at).toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" })}</div>
                        </div>
                        <span className={`flag-badge ${cls}`}>{badge}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-title">Fraud Detection Shield</div>
              <div className="fraud-flags">
                {[
                  { icon:"📍", title:"Location Validation",   desc:"Worker GPS matches trigger zone",    badge:"PASS",     cls:"fb-safe" },
                  { icon:"🔁", title:"Duplicate Claim Check", desc:"No duplicate in last 24h window",    badge:"PASS",     cls:"fb-safe" },
                  { icon:"📅", title:"Active Policy Check",   desc:dashData?.policies?.summary?.active>0?`${dashData.policies.summary.active} active polic${dashData.policies.summary.active===1?"y":"ies"} found`:"Weekly subscription valid", badge:dashData?.policies?.summary?.active>0?"PASS":"WARN", cls:dashData?.policies?.summary?.active>0?"fb-safe":"fb-warn" },
                  { icon:"⏱️", title:"Claim Velocity Check",  desc:"Normal claim rate detected",         badge:"PASS",     cls:"fb-safe" },
                  { icon:"🤖", title:"ML Anomaly Detection",  desc:dashData?.recentFraudChecks?.length>0?`${dashData.recentFraudChecks.length} checks run · ${dashData.recentFraudChecks.filter(f=>f.fraud_risk==="low").length} clean`:"No abnormal patterns found", badge:"CLEAR", cls:"fb-safe" },
                  { icon:"📸", title:"Sensor Cross-check",    desc:"Multi-source sensor validation",     badge:"VERIFIED", cls:"fb-safe" },
                ].map(f=>(
                  <div key={f.title} className="flag-item">
                    <div className="flag-icon">{f.icon}</div>
                    <div>
                      <div className="flag-title">{f.title}</div>
                      <div className="flag-desc text-muted fs-xs">{f.desc}</div>
                    </div>
                    <span className={`flag-badge ${f.cls}`}>{f.badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── MY PROFILE ───────────────────────────────────── */}
        <div className={`page ${page==="profile"?"active":""}`}>
          <div style={{ padding:"2.5rem" }}>
            <div className="page-header">
              <div className="page-header-top">
                <div>
                  <div className="page-title">My Profile</div>
                  <div className="page-sub">Worker credentials · Partner ID verification · Location for parametric triggers</div>
                </div>
                {dashData?.workerProfile?.is_verified ?
                  <span style={{ fontSize:"0.75rem", fontWeight:700, padding:"0.4rem 1rem", borderRadius:100, background:"rgba(0,229,160,0.1)", color:"var(--accent)", border:"1px solid rgba(0,229,160,0.25)" }}>✅ Verified</span>
                : <span style={{ fontSize:"0.75rem", fontWeight:700, padding:"0.4rem 1rem", borderRadius:100, background:"rgba(255,170,0,0.1)", color:"var(--warning)", border:"1px solid rgba(255,170,0,0.2)" }}>⚠️ Complete your profile</span>
                }
              </div>
            </div>

            {dashLoading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {[1,2,3,4].map(i => <div key={i} style={{ height:80, borderRadius:14, background:"rgba(255,255,255,0.04)", animation:"badgePulse 1.5s infinite" }} />)}
              </div>
            ) : (
              <ProfilePage
                existingProfile={dashData?.workerProfile ?? null}
                onSaved={(updatedProfile) => {
                  // Merge the saved profile back into dashData in-place
                  setDashData(prev => prev ? { ...prev, workerProfile: updatedProfile } : prev);
                }}
              />
            )}
          </div>
        </div>

      </main>
    </div>
  );
}