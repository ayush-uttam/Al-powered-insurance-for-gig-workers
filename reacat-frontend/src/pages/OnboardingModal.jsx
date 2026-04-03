import { useState } from "react";
import { getUser, workerApi } from "../services/api";
import "../styles/onboarding.css";

// ─── Constants ──────────────────────────────────────────────────
const BRANDS = [
  { key: "zomato",    label: "Zomato",    emoji: "🔴", hint: "ZMT-XXXXXX",  example: "ZMT-AB123456"  },
  { key: "swiggy",    label: "Swiggy",    emoji: "🟠", hint: "SWG-XXXXXX",  example: "SWG-XY789012"  },
  { key: "uber",      label: "Uber",      emoji: "⚫", hint: "UBXXXXXXXXX", example: "UBAB123456789" },
  { key: "ola",       label: "Ola",       emoji: "🟡", hint: "OL-XXXXXX",   example: "OL-CD345678"   },
  { key: "dunzo",     label: "Dunzo",     emoji: "🟢", hint: "DUN-XXXXX",   example: "DUN-EF5678"    },
  { key: "blinkit",   label: "Blinkit",   emoji: "🟡", hint: "BLK-XXXXXX",  example: "BLK-GH901234"  },
  { key: "zepto",     label: "Zepto",     emoji: "🟣", hint: "ZPT-XXXXXX",  example: "ZPT-IJ567890"  },
  { key: "rapido",    label: "Rapido",    emoji: "🔵", hint: "RPD-XXXXXX",  example: "RPD-KL123456"  },
  { key: "instamart", label: "Instamart", emoji: "🟠", hint: "INS-XXXXXX",  example: "INS-MN789012"  },
  { key: "other",     label: "Other",     emoji: "🏢", hint: "Any format",  example: "PARTNER-123"   },
];

const JOB_TYPES = [
  { value: "delivery",  label: "Delivery Partner 🛵" },
  { value: "rideshare", label: "Rideshare Driver 🚗"  },
  { value: "freelance", label: "Freelancer 💻"        },
  { value: "logistics", label: "Logistics Rider 🚛"   },
];

const VEHICLE_TYPES = [
  { value: "bicycle",    label: "Bicycle 🚲" },
  { value: "motorcycle", label: "Motorcycle / Scooter 🛵" },
  { value: "car",        label: "Car 🚗" },
  { value: "auto",       label: "Auto Rickshaw 🛺" },
  { value: "van",        label: "Van 🚐" },
  { value: "none",       label: "No Vehicle (Remote) 💻" },
];

const STATES_IN = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
];

const STEPS = ["Welcome", "Platform", "Job Details", "Location"];
const TOTAL_STEPS = STEPS.length;

// ─── Small field component ───────────────────────────────────────
function Field({ label, required, error, children }) {
  return (
    <div className="ob-field">
      <label className="ob-label">{label}{required && <span className="req"> *</span>}</label>
      {children}
      {error && <span className="ob-err">⚠️ {error}</span>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
export default function OnboardingModal({ onComplete, onSkip }) {
  const user = getUser();

  const [step, setStep]   = useState(0);   // 0=welcome,1=platform,2=job,3=location,4=done
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // ── Form data ────────────────────────────────────────────────
  const [form, setForm] = useState({
    partnerBrand:    "",
    partnerId:       "",
    jobType:         "",
    vehicleType:     "",
    averageIncome:   "",
    yearsExperience: "",
    city:            "",
    state:           "",
    address:         "",
    location:        "",
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
    setSaveErr("");
  };

  const selectedBrand = BRANDS.find(b => b.key === form.partnerBrand);

  // ── Per-step validation ──────────────────────────────────────
  const validateStep = () => {
    const errs = {};
    if (step === 1) {
      if (!form.partnerBrand) errs.partnerBrand = "Select your delivery platform";
      if (!form.partnerId?.trim()) errs.partnerId = "Partner ID is required";
    }
    if (step === 2) {
      if (!form.jobType) errs.jobType = "Select your job type";
      if (!form.averageIncome || Number(form.averageIncome) < 1000)
        errs.averageIncome = "Enter monthly income (min ₹1,000)";
    }
    if (step === 3) {
      if (!form.city?.trim())    errs.city    = "City is required";
      if (!form.state?.trim())   errs.state   = "State is required";
      if (!form.address?.trim()) errs.address = "At least a brief address is required";
      if (!form.location?.trim())errs.location= "Zone / locality is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit on last step ───────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSaving(true);
    setSaveErr("");
    try {
      const res = await workerApi.saveProfile({
        userId:          user.id,
        jobType:         form.jobType,
        partnerBrand:    form.partnerBrand,
        partnerId:       form.partnerId,
        averageIncome:   form.averageIncome,
        location:        form.location || form.city,
        city:            form.city,
        state:           form.state,
        address:         form.address,
        vehicleType:     form.vehicleType || null,
        yearsExperience: form.yearsExperience || 0,
      });
      setStep(4); // success screen
      setTimeout(() => onComplete(res.profile), 1800);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 0) { setStep(1); return; }
    if (!validateStep()) return;
    if (step < TOTAL_STEPS - 1) { setStep(s => s + 1); }
    else { handleSubmit(); }
  };

  const back = () => setStep(s => Math.max(0, s - 1));

  const progress = step === 4 ? 100 : Math.round((step / TOTAL_STEPS) * 100);

  // ── Render steps ─────────────────────────────────────────────
  const renderStep = () => {
    // Done
    if (step === 4) {
      return (
        <div className="ob-success">
          <span className="ob-success-icon">🎉</span>
          <div className="ob-success-title">Profile Created!</div>
          <div className="ob-success-msg">
            Your gig worker profile is verified.<br/>
            Redirecting you to your dashboard…
          </div>
        </div>
      );
    }

    // ── Step 0: Welcome ────────────────────────────────────────
    if (step === 0) return (
      <div className="ob-welcome-hero">
        <span className="ob-welcome-icon">🛵</span>
        <div className="ob-welcome-title">Welcome, {user?.name?.split(" ")[0] || "Rider"}!</div>
        <div className="ob-welcome-sub">
          Set up your gig worker profile in 3 quick steps to unlock parametric insurance — automatic payouts when weather, traffic, or air quality hits critical levels in your zone.
        </div>
        <div className="ob-feature-list">
          <div className="ob-feature-item">⚡ <span><strong>Automatic payouts</strong> — no claim filing needed</span></div>
          <div className="ob-feature-item">📍 <span><strong>Zone-based triggers</strong> — matched to where you work</span></div>
          <div className="ob-feature-item">🆔 <span><strong>Partner ID verification</strong> — links your platform account</span></div>
          <div className="ob-feature-item">🔒 <span><strong>100% secure</strong> — data never sold or shared</span></div>
        </div>
      </div>
    );

    // ── Step 1: Platform & Partner ID ──────────────────────────
    if (step === 1) return (
      <>
        <span className="ob-step-icon">🚀</span>
        <div className="ob-step-title">Your Delivery Platform</div>
        <div className="ob-step-desc">
          Select the platform you work with and enter your partner ID — it's used to verify your active work zone for parametric triggers.
        </div>

        <div className="ob-field" style={{ marginBottom:"1.25rem" }}>
          <label className="ob-label">Platform <span className="req">*</span></label>
          <div className="ob-brand-grid">
            {BRANDS.map(b => (
              <div key={b.key}
                className={`ob-brand-card ${form.partnerBrand === b.key ? "selected" : ""}`}
                onClick={() => set("partnerBrand", b.key)}>
                <span className="ob-brand-emoji">{b.emoji}</span>
                <span className="ob-brand-name">{b.label}</span>
              </div>
            ))}
          </div>
          {errors.partnerBrand && <span className="ob-err" style={{ marginTop:6 }}>⚠️ {errors.partnerBrand}</span>}
        </div>

        {form.partnerBrand && (
          <Field label={`${selectedBrand?.emoji} ${selectedBrand?.label} Partner ID`} required error={errors.partnerId}>
            <input className={`ob-input ${errors.partnerId ? "err" : ""}`}
              value={form.partnerId}
              onChange={e => set("partnerId", e.target.value.toUpperCase())}
              placeholder={selectedBrand?.example}
            />
            <span className="ob-hint">Format: <code>{selectedBrand?.hint}</code> · Found in your {selectedBrand?.label} partner app</span>
          </Field>
        )}
      </>
    );

    // ── Step 2: Job & Vehicle ──────────────────────────────────
    if (step === 2) return (
      <>
        <span className="ob-step-icon">🛵</span>
        <div className="ob-step-title">Job & Vehicle Details</div>
        <div className="ob-step-desc">Tell us about your work so we can match you to the right insurance plans.</div>
        <div className="ob-grid">

          <Field label="Job Type" required error={errors.jobType}>
            <select className={`ob-select ${errors.jobType ? "err" : ""}`}
              value={form.jobType} onChange={e => set("jobType", e.target.value)}>
              <option value="">Select…</option>
              {JOB_TYPES.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
          </Field>

          <Field label="Vehicle Type" error={errors.vehicleType}>
            <select className="ob-select" value={form.vehicleType} onChange={e => set("vehicleType", e.target.value)}>
              <option value="">Select…</option>
              {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </Field>

          <Field label="Avg. Monthly Income (₹)" required error={errors.averageIncome}>
            <input type="number" className={`ob-input ${errors.averageIncome ? "err" : ""}`}
              value={form.averageIncome} onChange={e => set("averageIncome", e.target.value)}
              placeholder="25000" min={1000} />
          </Field>

          <Field label="Years of Experience">
            <input type="number" className="ob-input"
              value={form.yearsExperience} onChange={e => set("yearsExperience", e.target.value)}
              placeholder="3" min={0} max={40} />
          </Field>

        </div>
      </>
    );

    // ── Step 3: Location ────────────────────────────────────────
    if (step === 3) return (
      <>
        <span className="ob-step-icon">📍</span>
        <div className="ob-step-title">Your Work Location</div>
        <div className="ob-step-desc">
          We use your location to link you to live environmental sensors. When a parametric trigger fires in your zone, you get paid automatically.
        </div>
        <div className="ob-grid">

          <Field label="City" required error={errors.city}>
            <input className={`ob-input ${errors.city ? "err" : ""}`}
              value={form.city} onChange={e => set("city", e.target.value)} placeholder="Mumbai" />
          </Field>

          <Field label="State" required error={errors.state}>
            <select className={`ob-select ${errors.state ? "err" : ""}`}
              value={form.state} onChange={e => set("state", e.target.value)}>
              <option value="">Select state…</option>
              {STATES_IN.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <div className="span-2">
            <Field label="Full Address / Area" required error={errors.address}>
              <textarea className={`ob-input ${errors.address ? "err" : ""}`}
                value={form.address} onChange={e => set("address", e.target.value)}
                placeholder="Flat 12, ABC Society, Andheri East…" rows={2}
                style={{ resize:"vertical", lineHeight:1.5 }} />
            </Field>
          </div>

          <div className="span-2">
            <Field label="Broad Zone / Locality" required error={errors.location}>
              <input className={`ob-input ${errors.location ? "err" : ""}`}
                value={form.location} onChange={e => set("location", e.target.value)}
                placeholder="Mumbai, Andheri East" />
              <span className="ob-hint">Used for parametric trigger zone mapping (e.g. rain alerts in your area)</span>
            </Field>
          </div>

        </div>

        {saveErr && (
          <div style={{ marginTop:"1rem", padding:"0.75rem 1rem", background:"rgba(255,68,102,0.08)", border:"1px solid rgba(255,68,102,0.2)", borderRadius:10, fontSize:"0.82rem", color:"var(--danger)" }}>
            ⚠️ {saveErr}
          </div>
        )}
      </>
    );
  };

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <div className="ob-backdrop">
      <div className="ob-card">

        {/* Header + progress */}
        {step < 4 && (
          <div className="ob-header">
            <div className="ob-logo">⚡ SafeRide AI — Onboarding</div>
            {step > 0 && (
              <>
                <div className="ob-title">{STEPS[step]}</div>
                <div className="ob-subtitle">Step {step} of {TOTAL_STEPS - 1}</div>
                <div className="ob-progress">
                  <div className="ob-progress-track">
                    <div className="ob-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="ob-step-labels">
                    {STEPS.slice(1).map((s, i) => (
                      <span key={s} className={`ob-step-label ${i + 1 <= step ? "active" : ""}`}>{s}</span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Body */}
        <div className="ob-body">
          {renderStep()}
        </div>

        {/* Footer */}
        {step < 4 && (
          <div className="ob-footer">
            <div className="ob-footer-left">
              {step === 0
                ? <button className="ob-skip" onClick={onSkip}>Skip for now →</button>
                : <span>🔒 Secured · Never shared</span>}
            </div>
            <div className="ob-footer-btns">
              {step > 0 && (
                <button className="ob-btn-back" onClick={back} disabled={saving}>← Back</button>
              )}
              <button className="ob-btn-next" onClick={next} disabled={saving}>
                {saving
                  ? <><div className="spinner" style={{ width:14, height:14, borderWidth:2, borderTopColor:"#050812" }} />Saving…</>
                  : step === 0 ? "Get Started →"
                  : isLastStep ? "✅ Complete Setup"
                  : "Next →"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
