import { useEffect, useRef, useState } from "react";
import { pathFor } from "../lib/router";
import { Sparkle } from "./AiSearchButton";
import SideMenu from "./SideMenu";
import { accountInfo } from "../lib/account";
import { supabase } from "../lib/supabaseClient";
import { libraries, libraryPages } from "../data/libraries";
import { fetchAssetCounts, formatCount } from "../lib/assetCounts";
import LibraryCover from "./LibraryCover";
import "./PageHeader.css";

function Avatar({ info }) {
  return info.avatar ? (
    <img className="site-avatar" src={info.avatar} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="site-avatar">{info.initial}</span>
  );
}

// AI comes first, as on Magnific and Envato; every asset library sits under
// one Assets menu (as Magnific's Stock), so a new library never crowds the bar
const navItems = [
  { page: "ai", label: "AI", sparkle: true },
  { page: "assets", label: "Assets", menu: true },
  { page: "create", label: "Create" },
];

// The site header shared by every page; App renders it above each page.
function PageHeader({ page, setPage, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  // the Assets mega menu, and each library's live count in it
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [counts, setCounts] = useState(null);
  const assetsRef = useRef(null);
  const closeTimer = useRef(null);
  // the owner's accounts get an Admin link in the menus
  const [isAdmin, setIsAdmin] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase.rpc("is_admin").then(({ data }) => alive && setIsAdmin(data === true));
    return () => {
      alive = false;
    };
  }, [user]);
  const admin = Boolean(user) && isAdmin;

  const go = (target) => (e) => {
    // Cmd/Ctrl-click opens the real address in a new tab
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setAccountOpen(false);
    setAssetsOpen(false);
    setPage(target);
    window.scrollTo(0, 0);
  };

  // close the account menu on a click outside or on Escape
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e) => !accountRef.current?.contains(e.target) && setAccountOpen(false);
    const onKey = (e) => e.key === "Escape" && setAccountOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  // the counts load the first time the menu opens
  useEffect(() => {
    if (!assetsOpen || counts) return;
    fetchAssetCounts().then(setCounts).catch(() => {});
  }, [assetsOpen, counts]);

  // close the Assets menu on a click outside or on Escape
  useEffect(() => {
    if (!assetsOpen) return;
    const onClick = (e) => !assetsRef.current?.contains(e.target) && setAssetsOpen(false);
    const onKey = (e) => e.key === "Escape" && setAssetsOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [assetsOpen]);

  // opens on hover (a short delay before closing, so the pointer can travel
  // down into the panel) and on click or keyboard
  const hoverAssets = (open) => {
    clearTimeout(closeTimer.current);
    if (open) setAssetsOpen(true);
    else closeTimer.current = setTimeout(() => setAssetsOpen(false), 160);
  };

  const info = accountInfo(user);

  return (
    <>
      <header className="site-header">
        <a className="site-brand" href={pathFor("home")} onClick={go("home")} aria-label="Khulqi Design home">
          <img src="/logo.png" alt="" className="site-brand-mark" />
          <img src="/KD Logogram.png" alt="Khulqi Design" className="site-brand-word" />
        </a>

        <nav className="site-nav" aria-label="Primary navigation">
          {navItems.map((item) => item.menu ? (
            <div
              key={item.page}
              className="site-assets"
              ref={assetsRef}
              onMouseEnter={() => hoverAssets(true)}
              onMouseLeave={() => hoverAssets(false)}
            >
              <button
                className={`site-assets-button ${libraryPages.has(page) ? "active" : ""} ${assetsOpen ? "open" : ""}`}
                onClick={() => setAssetsOpen(!assetsOpen)}
                aria-expanded={assetsOpen}
                aria-haspopup="true"
              >
                {item.label}
                <svg className="site-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {assetsOpen && (
                <div className="site-assets-panel">
                  <div className="site-assets-grid">
                    {libraries.map((lib) => (
                      <a key={lib.page} href={pathFor(lib.page)} onClick={go(lib.page)}
                         className={`site-assets-item ${page === lib.page ? "active" : ""}`}>
                        <LibraryCover library={lib} className="site-assets-cover" />
                        <span className="site-assets-text">
                          <strong>
                            {lib.title}
                            {lib.badge && <em>{lib.badge}</em>}
                          </strong>
                          <small>{lib.blurb}</small>
                        </span>
                        {counts?.[lib.type] > 0 && <span className="site-assets-count">{formatCount(counts[lib.type])}</span>}
                      </a>
                    ))}
                  </div>
                  <a className="site-assets-all" href={pathFor("assets")} onClick={go("assets")}>
                    Browse all assets <span aria-hidden="true">→</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <a
              key={item.page}
              href={pathFor(item.page)}
              className={page === item.page ? "active" : ""}
              onClick={go(item.page)}
            >
              {item.sparkle && <Sparkle size={15} />}
              {item.label}
            </a>
          ))}
        </nav>

        <div className="site-account">
          <a
            href={pathFor("pricing")}
            className={`site-pricing ${page === "pricing" ? "active" : ""}`}
            onClick={go("pricing")}
          >
            Pricing
          </a>
          <a
            href={pathFor("downloads")}
            className={`site-downloads ${page === "downloads" ? "active" : ""}`}
            onClick={go("downloads")}
            title="Your downloads"
          >
            <svg className="site-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
            </svg>
            <span>Downloads</span>
          </a>
          {user ? (
            <div className="site-account-menu" ref={accountRef}>
              <button
                className={`site-account-button ${accountOpen ? "open" : ""}`}
                onClick={() => setAccountOpen(!accountOpen)}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
              >
                <Avatar info={info} />
                <span className="site-account-name">{info.name}</span>
                <svg className="site-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {accountOpen && (
                <div className="site-account-dropdown" role="menu">
                  <div className="site-account-head">
                    <Avatar info={info} />
                    <div>
                      <strong>{info.name}</strong>
                      <small>{info.email}</small>
                    </div>
                  </div>
                  <a href={pathFor("account")} role="menuitem" onClick={go("account")}>Account</a>
                  <a href={pathFor("downloads")} role="menuitem" onClick={go("downloads")}>Your downloads</a>
                  <a href={pathFor("create")} role="menuitem" onClick={go("create")}>Your designs</a>
                  {admin && <a href={pathFor("admin")} role="menuitem" onClick={go("admin")}>Admin</a>}
                  <hr />
                  <button
                    role="menuitem"
                    className="danger"
                    onClick={() => {
                      setAccountOpen(false);
                      onLogout();
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <a href={pathFor("login")} className="site-login" onClick={go("login")}>Log in</a>
              <a href={pathFor("register")} className="site-register" onClick={go("register")}>Register</a>
            </>
          )}
        </div>

        <button className="site-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <svg className="site-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        page={page}
        setPage={setPage}
        user={user}
        isAdmin={admin}
        onLogout={onLogout}
      />
    </>
  );
}

export default PageHeader;
