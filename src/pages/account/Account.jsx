// Account: profile, plan and usage, what you've got (downloads, designs,
// exclusive logos) and settings. Name and password changes go straight to
// Supabase. Download counts and designs are read from this browser, like
// the Downloads page and Create; the plan, purchases and account deletion
// move to the backend with subscriptions.
import { useEffect, useState } from "react";
import "../vectors/Vectors.css";
import "./Account.css";
import Breadcrumb from "../../components/Breadcrumb";
import { supabase } from "../../lib/supabaseClient";
import { accountInfo } from "../../lib/account";
import { listProjects } from "../create/projectsStore";

// the Free plan's daily limit, as on Pricing; the server enforces it later
const FREE_DAILY = 10;
const CONTACT = "khulqidesign@mail.com";

function readDownloads() {
  try {
    return JSON.parse(localStorage.getItem("kd-downloads")) ?? [];
  } catch {
    return [];
  }
}

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

function Account({ user, setPage, onLogout }) {
  const info = accountInfo(user);
  const [name, setName] = useState(info.name);
  const [password, setPassword] = useState("");
  // { area: "name" | "password", ok: boolean, text }
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  // today's downloads as the server counts them (the limit it applies)
  const [today, setToday] = useState(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase.rpc("downloads_today").then(({ data }) => alive && data && setToday(data));
    return () => {
      alive = false;
    };
  }, [user]);

  const go = (page) => () => {
    setPage(page);
    window.scrollTo(0, 0);
  };

  if (!user) {
    return (
      <section className="vectors-page account-page">
        <div className="library-head">
          <Breadcrumb setPage={setPage} current="Account" />
          <h1>Account</h1>
        </div>
        <div className="ac-signin">
          <h2>Log in to see your account</h2>
          <p>Your plan, downloads, designs and settings live here.</p>
          <div>
            <button className="ac-main" onClick={go("login")}>Log in</button>
            <button onClick={go("register")}>Create free account</button>
          </div>
        </div>
      </section>
    );
  }

  const downloads = readDownloads();
  const localDay = new Date().toDateString();
  const downloadsToday = today;
  const usedToday = downloadsToday?.taken ?? downloads.filter((d) => new Date(d.date).toDateString() === localDay).length;
  const dailyLimit = downloadsToday?.limit ?? FREE_DAILY;
  const designs = listProjects().length;
  // email accounts have a password to change; Google accounts sign in there
  const provider = user.app_metadata?.provider ?? "email";
  const viaGoogle = provider === "google";

  const saveName = async (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || clean === info.name) return;
    setBusy("name");
    const { error } = await supabase.auth.updateUser({ data: { full_name: clean } });
    setBusy(null);
    setStatus(error
      ? { area: "name", ok: false, text: error.message }
      : { area: "name", ok: true, text: "Name saved." });
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setStatus({ area: "password", ok: false, text: "Use at least 6 characters." });
      return;
    }
    setBusy("password");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (!error) setPassword("");
    setStatus(error
      ? { area: "password", ok: false, text: error.message }
      : { area: "password", ok: true, text: "Password changed." });
  };

  const note = (area) =>
    status?.area === area && (
      <p className={`ac-status ${status.ok ? "ok" : "error"}`} role="status">{status.text}</p>
    );

  return (
    <section className="vectors-page account-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="Account" />
        <h1>Account</h1>
      </div>

      {/* PROFILE */}
      <div className="ac-profile">
        {info.avatar ? (
          <img className="ac-avatar" src={info.avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="ac-avatar">{info.initial}</span>
        )}
        <div>
          <h2>{info.name}</h2>
          <p>
            {info.email} · {viaGoogle ? "Signed in with Google" : "Email account"}
            {user.created_at && <> · Member since {formatDate(user.created_at)}</>}
          </p>
        </div>
        <button className="ac-logout" onClick={onLogout}>Log out</button>
      </div>

      <div className="ac-grid">
        {/* PLAN */}
        <div className="ac-card ac-plan">
          <p className="ac-label">Your plan</p>
          <h3>Free</h3>
          <div className="ac-meter" aria-label={`${usedToday} of ${dailyLimit} downloads today`}>
            <span style={{ width: `${Math.min(100, (usedToday / dailyLimit) * 100)}%` }} />
          </div>
          <p className="ac-small">
            {Math.min(usedToday, dailyLimit)} of {dailyLimit} downloads today · resets at midnight UTC
          </p>
          <button className="ac-main" onClick={go("pricing")}>Go Premium</button>
          <p className="ac-small">Unlimited downloads, no credit line, every format.</p>
        </div>

        {/* WHAT YOU HAVE */}
        <div className="ac-card">
          <p className="ac-label">Your library</p>
          <button className="ac-row" onClick={go("downloads")}>
            <span>Downloads</span><strong>{downloads.length}</strong>
          </button>
          <button className="ac-row" onClick={go("create")}>
            <span>Designs in Create</span><strong>{designs}</strong>
          </button>
          <button className="ac-row" onClick={go("logos")}>
            <span>Exclusive logos</span><strong>0</strong>
          </button>
          <p className="ac-small">
            Exclusive logos you buy appear here with their files and license. Downloads and
            designs are kept in this browser until your account syncs them.
          </p>
        </div>
      </div>

      {/* SETTINGS */}
      <div className="ac-card ac-settings">
        <p className="ac-label">Settings</p>

        <form onSubmit={saveName}>
          <label htmlFor="ac-name">Display name</label>
          <div>
            <input id="ac-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <button disabled={busy === "name" || !name.trim() || name.trim() === info.name}>
              {busy === "name" ? "Saving…" : "Save"}
            </button>
          </div>
          {note("name")}
        </form>

        {viaGoogle ? (
          <div className="ac-field">
            <span className="ac-field-name">Password</span>
            <p className="ac-small">You sign in with Google, so your password is managed there.</p>
          </div>
        ) : (
          <form onSubmit={savePassword}>
            <label htmlFor="ac-password">New password</label>
            <div>
              <input
                id="ac-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button disabled={busy === "password" || !password}>
                {busy === "password" ? "Saving…" : "Change"}
              </button>
            </div>
            {note("password")}
          </form>
        )}

        <div className="ac-field">
          <span className="ac-field-name">Delete account</span>
          <p className="ac-small">
            Email <a href={`mailto:${CONTACT}?subject=Delete my account`}>{CONTACT}</a> from this
            address and we'll remove your account and personal data, as set out in the{" "}
            <button className="ac-link" onClick={go("privacy")}>Privacy Policy</button>.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Account;
