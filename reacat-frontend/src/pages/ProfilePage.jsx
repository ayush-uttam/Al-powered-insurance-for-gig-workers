import { useState, useRef } from "react";
import { getUser, workerApi, otpApi } from "../services/api";
import "../styles/profile.css";

// ─── Supported partner brands ──────────────────────────────────
const BRANDS = [
  { key: "zomato",    label: "Zomato",    emoji: "🔴", example: "ZMT-AB123456",  hint: "ZMT-XXXXXX" },
  { key: "swiggy",    label: "Swiggy",    emoji: "🟠", example: "SWG-XY789012",  hint: "SWG-XXXXXX" },
  { key: "uber",      label: "Uber",      emoji: "⚫", example: "UBAB123456789", hint: "UBXXXXXXXXX" },
  { key: "ola",       label: "Ola",       emoji: "🟡", example: "OL-CD345678",   hint: "OL-XXXXXX" },
  { key: "dunzo",     label: "Dunzo",     emoji: "🟢", example: "DUN-EF5678",    hint: "DUN-XXXXX" },
  { key: "blinkit",   label: "Blinkit",   emoji: "🟡", example: "BLK-GH901234",  hint: "BLK-XXXXXX" },
  { key: "zepto",     label: "Zepto",     emoji: "🟣", example: "ZPT-IJ567890",  hint: "ZPT-XXXXXX" },
  { key: "rapido",    label: "Rapido",    emoji: "🔵", example: "RPD-KL123456",  hint: "RPD-XXXXXX" },
  { key: "instamart", label: "Instamart", emoji: "🟠", example: "INS-MN789012",  hint: "INS-XXXXXX" },
  { key: "other",     label: "Other",     emoji: "🏢", example: "PARTNER-123",   hint: "Any alphanumeric" },
];

const JOB_TYPES = [
  { value: "delivery",  label: "Delivery Partner" },
  { value: "rideshare", label: "Rideshare Driver"  },
  { value: "freelance", label: "Freelancer"        },
  { value: "logistics", label: "Logistics Rider"   },
];

const VEHICLE_TYPES = [
  { value: "bicycle",    label: "Bicycle" },
  { value: "motorcycle", label: "Motorcycle / Scooter" },
  { value: "car",        label: "Car" },
  { value: "auto",       label: "Auto Rickshaw" },
  { value: "van",        label: "Van / Mini Truck" },
  { value: "none",       label: "No Vehicle (Remote)" },
];

const STATES_IN = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
];

// ─── Location verification states ─────────────────────────────
const LOC_STATUS = {
  IDLE:       "idle",
  REQUESTING: "requesting",
  GPS_OK:     "gps_ok",
  VERIFIED:   "verified",
  MISMATCH:   "mismatch",
  ERROR:      "error",
};

function normaliseCity(str = "") {
  return str.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
}

function matchesSomeState(stateStr = "") {
  const norm = stateStr.toLowerCase();
  return STATES_IN.find(s =>
    s.toLowerCase() === norm ||
    norm.includes(s.toLowerCase().split(" ")[0])
  ) ?? null;
}

// ─── Form validation ───────────────────────────────────────────
function validate(fields) {
  const errors = {};
  if (!fields.name?.trim())       errors.name         = "Full name is required";
  if (!fields.address?.trim())    errors.address      = "Address is required";
  if (!fields.city?.trim())       errors.city         = "City is required";
  if (!fields.state?.trim())      errors.state        = "State is required";
  if (!fields.partnerBrand)       errors.partnerBrand = "Select your delivery brand";
  if (!fields.partnerId?.trim())  errors.partnerId    = "Partner ID is required";
  if (!fields.jobType)            errors.jobType      = "Select your job type";
  if (!fields.location?.trim())   errors.location     = "Broad location is required";
  if (!fields.averageIncome || Number(fields.averageIncome) < 1000)
    errors.averageIncome = "Enter monthly income (min ₹1,000)";
  if (fields.licenseNumber) {
    const clean = fields.licenseNumber.replace(/[-\s]/g, "").toUpperCase();
    if (!/^[A-Z]{2}[0-9]{13}$/.test(clean))
      errors.licenseNumber = "Invalid license format. Example: MH1220230012345";
  }
  return errors;
}

// ══════════════════════════════════════════════════════════════
export default function ProfilePage({ existingProfile, onSaved }) {
  const user = getUser();

  const [form, setForm] = useState({
    name:            user?.name ?? "",
    address:         existingProfile?.address ?? "",
    city:            existingProfile?.city ?? "",
    state:           existingProfile?.state ?? "",
    partnerBrand:    existingProfile?.partner_brand ?? "",
    partnerId:       existingProfile?.partner_id ?? "",
    jobType:         existingProfile?.job_type ?? "",
    location:        existingProfile?.location ?? "",
    vehicleType:     existingProfile?.vehicle_type ?? "",
    licenseNumber:   existingProfile?.license_number ?? "",
    averageIncome:   existingProfile?.average_income ?? "",
    yearsExperience: existingProfile?.years_experience ?? "",
  });

  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(null);
  const [apiErr,  setApiErr]  = useState("");

  // ── OTP state ─────────────────────────────────────────────────
  const [phone,           setPhone]           = useState("");
  const [phoneError,      setPhoneError]      = useState("");
  const [otpSent,         setOtpSent]         = useState(false);
  const [otpSending,      setOtpSending]      = useState(false);
  const [otpValue,        setOtpValue]        = useState("");
  const [otpVerifying,    setOtpVerifying]    = useState(false);
  const [otpError,        setOtpError]        = useState("");
  const [otpSuccess,      setOtpSuccess]      = useState("");
  const [licenseVerified, setLicenseVerified] = useState(existingProfile?.license_verified ?? false);
  const [devOtp,          setDevOtp]          = useState("");
  const [countdown,       setCountdown]       = useState(0);
  const countdownRef = useRef(null);

  const startCountdown = () => {
    setCountdown(60);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // ── Location state ─────────────────────────────────────────────
  const [locStatus, setLocStatus] = useState(LOC_STATUS.IDLE);
  const [locGps,    setLocGps]    = useState(null);
  const [locIp,     setLocIp]     = useState(null);
  const [locError,  setLocError]  = useState("");
  const [coords,    setCoords]    = useState(null);

  const selectedBrand = BRANDS.find(b => b.key === form.partnerBrand);

  // ── Field change ───────────────────────────────────────────────
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
    setSuccess(null);
    setApiErr("");
  };

  // ── OTP: Send ─────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setPhoneError("");
    setOtpError("");
    setDevOtp("");
    const ph = phone.replace(/\D/g, "");
    if (ph.length !== 10) { setPhoneError("Enter a valid 10-digit Indian mobile number"); return; }
    if (!form.licenseNumber) { setOtpError("Enter your license number first"); return; }
    setOtpSending(true);
    try {
      const res = await otpApi.send(user.id, phone, form.licenseNumber);
      setOtpSent(true);
      startCountdown();
      if (res.devOtp) setDevOtp(res.devOtp);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpSending(false);
    }
  };

  // ── OTP: Verify ───────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    setOtpError("");
    if (otpValue.length !== 6) { setOtpError("Enter the 6-digit OTP"); return; }
    setOtpVerifying(true);
    try {
      const res = await otpApi.verify(user.id, phone, otpValue, form.licenseNumber);
      setOtpSuccess(res.message);
      setLicenseVerified(true);
      setOtpSent(false);
      if (onSaved) onSaved({ ...existingProfile, license_verified: true });
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Location: Detect ──────────────────────────────────────────
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus(LOC_STATUS.ERROR);
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    setLocStatus(LOC_STATUS.REQUESTING);
    setLocError("");
    setLocGps(null);
    setLocIp(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setCoords({ lat, lng });
        setLocStatus(LOC_STATUS.GPS_OK);
        try {
          const geoRes  = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
          const geoData = await geoRes.json();
          const gpsCity     = geoData.city || geoData.locality || "";
          const gpsLocality = geoData.locality || "";
          const gpsState    = geoData.principalSubdivision || "";
          const gpsLocation = [gpsLocality || gpsCity, gpsCity].filter(Boolean).join(", ");
          setLocGps({ city: gpsCity, state: gpsState, locality: gpsLocality, lat, lng });

          let ipCity = "", ipState = "", ipAddr = "";
          try {
            const ipRes  = await fetch("https://ipapi.co/json/");
            const ipData = await ipRes.json();
            ipCity  = ipData.city   || "";
            ipState = ipData.region || "";
            ipAddr  = ipData.ip     || "";
          } catch { /* IP lookup optional */ }
          setLocIp({ city: ipCity, state: ipState, ip: ipAddr });

          const gpsCityNorm = normaliseCity(gpsCity);
          const ipCityNorm  = normaliseCity(ipCity);
          const citiesMatch = gpsCityNorm && ipCityNorm && (
            gpsCityNorm === ipCityNorm ||
            gpsCityNorm.includes(ipCityNorm) ||
            ipCityNorm.includes(gpsCityNorm)
          );
          setLocStatus(citiesMatch ? LOC_STATUS.VERIFIED : LOC_STATUS.MISMATCH);

          const matchedState = matchesSomeState(gpsState) || matchesSomeState(ipState) || null;
          setForm(f => ({
            ...f,
            city:     f.city     || gpsCity,
            state:    f.state    || matchedState || gpsState,
            location: f.location || gpsLocation || gpsCity,
          }));
          if (gpsCity) {
            setErrors(e => { const n = { ...e }; delete n.city; delete n.location; return n; });
          }
        } catch {
          setLocStatus(LOC_STATUS.ERROR);
          setLocError("Could not reverse-geocode. Please enter manually.");
        }
      },
      (err) => {
        setLocStatus(LOC_STATUS.ERROR);
        if (err.code === 1) setLocError("Location access denied. Allow location in your browser and retry.");
        else if (err.code === 2) setLocError("Location unavailable. Turn on GPS or enter manually.");
        else setLocError("Location request timed out. Please enter manually.");
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  // ── Form submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiErr("");
    setSuccess(null);
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const res = await workerApi.saveProfile({
        userId:          user.id,
        jobType:         form.jobType,
        partnerBrand:    form.partnerBrand,
        partnerId:       form.partnerId,
        averageIncome:   form.averageIncome,
        location:        form.location,
        city:            form.city,
        state:           form.state,
        address:         form.address,
        vehicleType:     form.vehicleType || null,
        licenseNumber:   form.licenseNumber || null,
        yearsExperience: form.yearsExperience || 0,
        ...(coords ? { gpsLat: coords.lat, gpsLng: coords.lng } : {}),
      });
      setSuccess({ message: res.message, brand: res.partnerBrand, license: res.licenseVerified });
      if (onSaved) onSaved(res.profile);
    } catch (err) {
      setApiErr(err.message);
      if (err.message?.toLowerCase().includes("partner id"))
        setErrors(prev => ({ ...prev, partnerId: err.message }));
      else if (err.message?.toLowerCase().includes("license"))
        setErrors(prev => ({ ...prev, licenseNumber: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const isVerified = existingProfile?.is_verified;

  // ── Location button UI ────────────────────────────────────────
  const locUI = {
    [LOC_STATUS.IDLE]:       { label: "📍 Detect My Location",       color:"var(--accent)",  bg:"rgba(0,229,160,0.08)",  border:"rgba(0,229,160,0.2)" },
    [LOC_STATUS.REQUESTING]: { label: "⏳ Requesting GPS access…",    color:"var(--warning)", bg:"rgba(255,170,0,0.07)",  border:"rgba(255,170,0,0.2)",  disabled:true },
    [LOC_STATUS.GPS_OK]:     { label: "🔄 Cross-checking with IP…",  color:"var(--accent4)", bg:"rgba(0,180,255,0.07)",  border:"rgba(0,180,255,0.2)",  disabled:true },
    [LOC_STATUS.VERIFIED]:   { label: "✅ GPS + IP Verified",         color:"var(--accent)",  bg:"rgba(0,229,160,0.08)",  border:"rgba(0,229,160,0.25)" },
    [LOC_STATUS.MISMATCH]:   { label: "⚠️ GPS Detected (IP differs)",color:"var(--warning)", bg:"rgba(255,170,0,0.07)",  border:"rgba(255,170,0,0.2)" },
    [LOC_STATUS.ERROR]:      { label: "📍 Retry Location",            color:"var(--danger)",  bg:"rgba(255,68,102,0.07)", border:"rgba(255,68,102,0.2)" },
  };
  const ui = locUI[locStatus];

  // ─────────────────────────────────────────────────────────────
  return (
    <form className="profile-form" onSubmit={handleSubmit} noValidate>

      {/* ── Verification badges ──────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", flexWrap:"wrap" }}>
        {isVerified
          ? <span className="profile-verified-badge">✅ Profile Verified</span>
          : <span className="profile-unverified-badge">⚠️ Profile Not Verified</span>}
        {licenseVerified && <span className="profile-verified-badge">🪪 License OTP Verified</span>}
        {existingProfile?.partner_brand && (
          <span className="profile-verified-badge">
            {BRANDS.find(b=>b.key===existingProfile.partner_brand)?.emoji}{" "}
            {BRANDS.find(b=>b.key===existingProfile.partner_brand)?.label} Partner
          </span>
        )}
        {locStatus===LOC_STATUS.VERIFIED && <span className="profile-verified-badge">📍 Location Verified</span>}
      </div>

      {/* ── Success banner ───────────────────────────────────── */}
      {success && (
        <div className="form-success-banner">
          <span style={{ fontSize:"1.3rem" }}>🎉</span>
          <div>
            <div>{success.message}</div>
            <div style={{ fontSize:"0.75rem", marginTop:3, color:"rgba(0,229,160,0.75)" }}>
              {success.brand} partner ID validated ·{" "}
              {success.license ? "License verified 🪪" : "Add license for discounts"}
            </div>
          </div>
        </div>
      )}

      {/* ── API error ────────────────────────────────────────── */}
      {apiErr && (
        <div style={{ color:"var(--danger)", background:"rgba(255,68,102,0.07)", border:"1px solid rgba(255,68,102,0.2)", borderRadius:10, padding:"12px 18px", fontSize:"0.85rem" }}>
          ⚠️ {apiErr}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SECTION 1 — Personal Details
      ════════════════════════════════════════════════════════ */}
      <div className="form-section">
        <div className="form-section-title">👤 Personal Details</div>
        <div className="form-grid">

          <div className="form-field">
            <label className="form-label">Full Name <span className="required">*</span></label>
            <input className={`form-input ${errors.name?"error":""}`}
              value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Rajan Kumar" />
            {errors.name && <span className="form-error">⚠️ {errors.name}</span>}
          </div>

          <div className="form-field">
            <label className="form-label">City <span className="required">*</span></label>
            <div style={{ position:"relative" }}>
              <input className={`form-input ${errors.city?"error":form.city&&!errors.city?"success":""}`}
                value={form.city} onChange={e=>set("city",e.target.value)} placeholder="Mumbai" />
              {locStatus===LOC_STATUS.VERIFIED && form.city &&
                <span style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"var(--accent)",fontSize:"0.9rem" }}>📍</span>}
            </div>
            {errors.city && <span className="form-error">⚠️ {errors.city}</span>}
          </div>

          <div className="form-field span-2">
            <label className="form-label">Full Address <span className="required">*</span></label>
            <textarea className={`form-textarea ${errors.address?"error":""}`}
              value={form.address} onChange={e=>set("address",e.target.value)}
              placeholder="Flat No. 12, ABC Society, Andheri East…" rows={2} />
            {errors.address && <span className="form-error">⚠️ {errors.address}</span>}
          </div>

          <div className="form-field">
            <label className="form-label">State <span className="required">*</span></label>
            <select className={`form-select ${errors.state?"error":""}`}
              value={form.state} onChange={e=>set("state",e.target.value)}>
              <option value="">Select state…</option>
              {STATES_IN.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            {errors.state && <span className="form-error">⚠️ {errors.state}</span>}
          </div>

          {/* ── Broad Location / Zone + GPS Detect ──────────── */}
          <div className="form-field">
            <label className="form-label">Broad Location / Zone <span className="required">*</span></label>

            <button type="button" disabled={ui.disabled} onClick={detectLocation}
              style={{ display:"flex",alignItems:"center",gap:"0.5rem",
                background:ui.bg,color:ui.color,border:`1px solid ${ui.border}`,
                borderRadius:"var(--radius-sm)",padding:"0.5rem 0.875rem",
                fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:"0.78rem",
                cursor:ui.disabled?"not-allowed":"pointer",marginBottom:"0.5rem",
                transition:"all 0.2s",width:"fit-content" }}>
              {locStatus===LOC_STATUS.REQUESTING||locStatus===LOC_STATUS.GPS_OK
                ? <><div className="spinner" style={{ width:13,height:13,borderWidth:2 }} />{ui.label}</>
                : ui.label}
            </button>

            {(locGps||locIp) && locStatus!==LOC_STATUS.IDLE && (
              <div style={{ background:locStatus===LOC_STATUS.VERIFIED?"rgba(0,229,160,0.04)":"rgba(255,170,0,0.04)",
                border:`1px solid ${locStatus===LOC_STATUS.VERIFIED?"rgba(0,229,160,0.2)":"rgba(255,170,0,0.2)"}`,
                borderRadius:"var(--radius-sm)",padding:"0.65rem 0.875rem",fontSize:"0.72rem",
                marginBottom:"0.5rem",display:"flex",flexDirection:"column",gap:"0.3rem" }}>
                {locGps && (
                  <div style={{ display:"flex",alignItems:"center",gap:"0.5rem" }}>
                    <span>📡 GPS:</span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace",color:"var(--accent)" }}>
                      {locGps.locality||locGps.city}, {locGps.state}
                    </span>
                    <span style={{ color:"var(--text2)" }}>({locGps.lat.toFixed(4)}, {locGps.lng.toFixed(4)})</span>
                  </div>
                )}
                {locIp?.city && (
                  <div style={{ display:"flex",alignItems:"center",gap:"0.5rem" }}>
                    <span>🌐 IP:</span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace",color:locStatus===LOC_STATUS.VERIFIED?"var(--accent)":"var(--warning)" }}>
                      {locIp.city}, {locIp.state}
                    </span>
                    {locIp.ip && <span style={{ color:"var(--text2)" }}>({locIp.ip})</span>}
                  </div>
                )}
                <div style={{ fontWeight:700,color:locStatus===LOC_STATUS.VERIFIED?"var(--accent)":"var(--warning)",marginTop:2 }}>
                  {locStatus===LOC_STATUS.VERIFIED
                    ? "✅ GPS and IP locations match — zone verified"
                    : "⚠️ GPS and IP locations differ — using GPS (more accurate)"}
                </div>
              </div>
            )}

            <div style={{ position:"relative" }}>
              <input className={`form-input ${errors.location?"error":form.location&&!errors.location?"success":""}`}
                value={form.location} onChange={e=>set("location",e.target.value)}
                placeholder="Mumbai, Andheri East" />
              {(locStatus===LOC_STATUS.VERIFIED||locStatus===LOC_STATUS.MISMATCH)&&form.location &&
                <span style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:"0.8rem" }}>📍</span>}
            </div>
            <span className="form-hint">Used for parametric trigger zone mapping · Can be edited manually</span>
            {errors.location && <span className="form-error">⚠️ {errors.location}</span>}
            {locStatus===LOC_STATUS.ERROR && locError &&
              <span className="form-error" style={{ marginTop:4 }}>⚠️ {locError}</span>}
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SECTION 2 — Driving License + OTP Verification
      ════════════════════════════════════════════════════════ */}
      <div className="form-section">
        <div className="form-section-title">
          🪪 Driving License
          {licenseVerified && (
            <span style={{ marginLeft:8,fontSize:"0.7rem",padding:"0.2rem 0.6rem",borderRadius:100,
              background:"rgba(0,229,160,0.12)",color:"var(--accent)",border:"1px solid rgba(0,229,160,0.2)" }}>
              ✅ OTP Verified
            </span>
          )}
        </div>
        <div className="form-grid">

          {/* License Number */}
          <div className="form-field span-2">
            <label className="form-label">
              License Number{" "}
              <span style={{ color:"var(--text2)",fontWeight:400 }}>(optional but recommended)</span>
            </label>
            <div className="input-verified">
              <input
                className={`form-input ${errors.licenseNumber?"error":form.licenseNumber&&!errors.licenseNumber?"success":""}`}
                value={form.licenseNumber}
                onChange={e => {
                  set("licenseNumber",e.target.value.toUpperCase());
                  setOtpSent(false); setOtpSuccess(""); setLicenseVerified(false); setDevOtp("");
                }}
                placeholder="MH1220230012345" maxLength={18}
                disabled={licenseVerified}
              />
              {licenseVerified
                ? <span className="verified-tick">✅</span>
                : form.licenseNumber && !errors.licenseNumber
                  ? <span className="verified-tick">✓</span>
                  : null}
            </div>
            <span className="form-hint">
              Indian format: 2-letter state code + 2-digit RTO + 4-digit year + 7-digit number<br/>
              Example: <code style={{ color:"var(--accent)",background:"rgba(0,229,160,0.06)",padding:"0 4px",borderRadius:4 }}>MH1220230012345</code>
            </span>
            {errors.licenseNumber && <span className="form-error">⚠️ {errors.licenseNumber}</span>}
          </div>

          {/* OTP panel — always visible, Send OTP disabled until license is valid */}
          {!licenseVerified && (() => {
            const dlClean = form.licenseNumber?.replace(/[-\s]/g,"").toUpperCase() ?? "";
            const dlValid = /^[A-Z]{2}[0-9]{13}$/.test(dlClean);
            return (
            <div className="form-field span-2">
              <div style={{ background:"rgba(0,229,160,0.03)",border:"1px solid rgba(0,229,160,0.15)",
                borderRadius:"var(--radius)",padding:"1.25rem" }}>

                <div style={{ fontSize:"0.75rem",fontWeight:700,color:"var(--accent)",
                  letterSpacing:1,textTransform:"uppercase",marginBottom:"1rem" }}>
                  📱 Verify via OTP — sent to DL-linked mobile
                </div>

                {/* Phone + Send OTP row */}
                <div style={{ display:"flex",gap:"0.75rem",alignItems:"flex-start",flexWrap:"wrap",marginBottom:"0.75rem" }}>
                  <div style={{ flex:1,minWidth:200 }}>
                    <label className="form-label" style={{ marginBottom:4 }}>
                      Mobile linked to DL <span className="required">*</span>
                    </label>
                    <div style={{ display:"flex",alignItems:"center",
                      background:"var(--surface2)",
                      border:`1px solid ${phoneError?"var(--danger)":"var(--border)"}`,
                      borderRadius:"var(--radius-sm)",overflow:"hidden" }}>
                      <span style={{ padding:"0 0.75rem",color:"var(--text2)",fontSize:"0.85rem",
                        borderRight:"1px solid var(--border)",display:"flex",alignItems:"center",
                        background:"rgba(255,255,255,0.02)",whiteSpace:"nowrap",lineHeight:"2.6rem" }}>
                        +91
                      </span>
                      <input
                        style={{ flex:1,background:"transparent",border:"none",outline:"none",
                          padding:"0.7rem 0.75rem",color:"var(--text)",
                          fontFamily:"'Space Grotesk',sans-serif",fontSize:"0.9rem" }}
                        value={phone}
                        onChange={e=>{ setPhone(e.target.value.replace(/\D/g,"").slice(0,10)); setPhoneError(""); }}
                        placeholder="9876543210" maxLength={10} inputMode="numeric"
                        disabled={otpSent && countdown > 0}
                      />
                    </div>
                    {phoneError && <span className="form-error">⚠️ {phoneError}</span>}
                  </div>

                  <button type="button" onClick={handleSendOtp}
                    disabled={!dlValid || otpSending||(otpSent&&countdown>0)}
                    className="btn btn-outline"
                    title={!dlValid ? "Enter a valid license number first" : ""}
                    style={{ marginTop:22,minWidth:140,fontSize:"0.82rem",padding:"0.65rem 1rem",
                      opacity: !dlValid ? 0.45 : 1 }}>
                    {otpSending
                      ? <><div className="spinner" style={{ width:13,height:13,borderWidth:2 }} />Sending…</>
                      : otpSent && countdown > 0
                        ? `Resend in ${countdown}s`
                        : otpSent ? "Resend OTP" : "💬 Send OTP"}
                  </button>
                </div>

                {/* Dev mode OTP hint */}
                {devOtp && (
                  <div style={{ fontSize:"0.72rem",background:"rgba(255,170,0,0.08)",
                    border:"1px solid rgba(255,170,0,0.25)",borderRadius:8,
                    padding:"0.5rem 0.875rem",marginBottom:"0.75rem",color:"var(--warning)" }}>
                    🛠️ <strong>DEV MODE</strong> — Twilio not configured. Your OTP is:{" "}
                    <strong style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:"1.1rem",letterSpacing:"0.2rem" }}>
                      {devOtp}
                    </strong>
                  </div>
                )}

                {/* OTP input + Verify button */}
                {otpSent && (
                  <div>
                    <label className="form-label" style={{ marginBottom:"0.5rem" }}>Enter 6-digit OTP</label>
                    <div style={{ display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap" }}>
                      <input
                        style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:"1.5rem",fontWeight:700,
                          letterSpacing:"0.5rem",textAlign:"center",
                          background:"var(--surface2)",
                          border:`1px solid ${otpError?"var(--danger)":"var(--border)"}`,
                          borderRadius:"var(--radius-sm)",padding:"0.6rem 1rem",
                          color:"var(--text)",outline:"none",width:"200px" }}
                        value={otpValue}
                        onChange={e=>{ setOtpValue(e.target.value.replace(/\D/g,"").slice(0,6)); setOtpError(""); }}
                        placeholder="──────" maxLength={6} inputMode="numeric"
                      />
                      <button type="button" className="btn btn-primary"
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying||otpValue.length!==6}
                        style={{ fontSize:"0.85rem",padding:"0.65rem 1.25rem" }}>
                        {otpVerifying
                          ? <><div className="spinner" style={{ width:13,height:13,borderWidth:2 }} />Verifying…</>
                          : "✅ Verify OTP"}
                      </button>
                    </div>
                    {otpError && <span className="form-error" style={{ marginTop:6 }}>⚠️ {otpError}</span>}
                  </div>
                )}

                {!otpSent && otpError && <span className="form-error">⚠️ {otpError}</span>}

                {/* Hint when license not yet entered */}
                {!dlValid && !otpSent && (
                  <div style={{ fontSize:"0.72rem", color:"var(--text2)", marginTop:4 }}>
                    ℹ️ Enter a valid Indian license number above to enable OTP verification
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* License verified success card */}
          {(licenseVerified || otpSuccess) && (
            <div className="form-field span-2">
              <div className="form-success-banner">
                <span style={{ fontSize:"1.3rem" }}>🪪</span>
                <div>
                  <div>{otpSuccess || "Driving license verified successfully"}</div>
                  <div style={{ fontSize:"0.72rem",marginTop:3,color:"rgba(0,229,160,0.75)" }}>
                    License: <span style={{ fontFamily:"'JetBrains Mono',monospace" }}>{form.licenseNumber}</span>{" "}
                    · OTP verified ✅
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SECTION 3 — Delivery Brand & Partner ID
      ════════════════════════════════════════════════════════ */}
      <div className="form-section">
        <div className="form-section-title">🚀 Delivery Platform & Partner ID</div>

        <div className="form-field" style={{ marginBottom:"1.25rem" }}>
          <label className="form-label">Select Your Brand <span className="required">*</span></label>
          <div className="brand-grid">
            {BRANDS.map(b => (
              <div key={b.key}
                className={`brand-card ${form.partnerBrand===b.key?"selected":""}`}
                onClick={()=>set("partnerBrand",b.key)}>
                <span className="brand-emoji">{b.emoji}</span>
                <span className="brand-name">{b.label}</span>
              </div>
            ))}
          </div>
          {errors.partnerBrand && <span className="form-error" style={{ marginTop:8 }}>⚠️ {errors.partnerBrand}</span>}
        </div>

        {form.partnerBrand && (
          <div className="form-field">
            <label className="form-label">
              {selectedBrand?.emoji} {selectedBrand?.label} Partner ID <span className="required">*</span>
            </label>
            <div className="input-verified">
              <input className={`form-input ${errors.partnerId?"error":""}`}
                value={form.partnerId}
                onChange={e=>set("partnerId",e.target.value.toUpperCase())}
                placeholder={selectedBrand?.example} />
            </div>
            <div className="partner-id-hint">Format: {selectedBrand?.hint}</div>
            <span className="form-hint">
              Issued by {selectedBrand?.label}. Used to authenticate your work zone for parametric triggers.
            </span>
            {errors.partnerId && <span className="form-error">⚠️ {errors.partnerId}</span>}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          SECTION 4 — Job & Vehicle Details
      ════════════════════════════════════════════════════════ */}
      <div className="form-section">
        <div className="form-section-title">🛵 Job & Vehicle Details</div>
        <div className="form-grid cols-3">

          <div className="form-field">
            <label className="form-label">Job Type <span className="required">*</span></label>
            <select className={`form-select ${errors.jobType?"error":""}`}
              value={form.jobType} onChange={e=>set("jobType",e.target.value)}>
              <option value="">Select…</option>
              {JOB_TYPES.map(j=><option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
            {errors.jobType && <span className="form-error">⚠️ {errors.jobType}</span>}
          </div>

          <div className="form-field">
            <label className="form-label">Vehicle Type</label>
            <select className="form-select" value={form.vehicleType} onChange={e=>set("vehicleType",e.target.value)}>
              <option value="">Select…</option>
              {VEHICLE_TYPES.map(v=><option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Years of Experience</label>
            <input type="number" className="form-input"
              value={form.yearsExperience} onChange={e=>set("yearsExperience",e.target.value)}
              min={0} max={40} placeholder="3" />
          </div>

          <div className="form-field">
            <label className="form-label">Avg. Monthly Income (₹) <span className="required">*</span></label>
            <input type="number" className={`form-input ${errors.averageIncome?"error":""}`}
              value={form.averageIncome} onChange={e=>set("averageIncome",e.target.value)}
              placeholder="25000" min={1000} />
            {errors.averageIncome && <span className="form-error">⚠️ {errors.averageIncome}</span>}
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SUBMIT
      ════════════════════════════════════════════════════════ */}
      <div className="form-submit-row">
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth:180 }}>
          {saving
            ? <><div className="spinner" />Saving &amp; Verifying…</>
            : existingProfile ? "💾 Update Profile" : "✅ Save & Verify Profile"}
        </button>
        {saving && (
          <span className="form-saving">
            Validating Partner ID with {selectedBrand?.label ?? "brand"} records…
          </span>
        )}
      </div>

      {/* ── Privacy note ─────────────────────────────────────── */}
      <div style={{ fontSize:"0.75rem",color:"var(--text2)",lineHeight:1.7,padding:"0.75rem 1rem",
        background:"rgba(255,255,255,0.02)",borderRadius:10,border:"1px solid var(--border)" }}>
        🔒 <strong style={{ color:"var(--text)" }}>Privacy & Security:</strong> OTP is sent to the mobile number registered with your driving license. Location data is used only for zone mapping and is never sold or shared.<br/>
        🌍 <strong style={{ color:"var(--text)" }}>How it works:</strong> GPS coordinates are cross-validated with your IP. A verified zone makes you automatically eligible when a parametric trigger fires in your area.
      </div>

    </form>
  );
}
