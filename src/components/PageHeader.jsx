import { useEffect, useRef, useState } from "react";
import SideMenu from "./SideMenu";
import { accountInfo } from "../lib/account";
import "./PageHeader.css";

function Avatar({ info }) {
  return info.avatar ? (
    <img className="site-avatar" src={info.avatar} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="site-avatar">{info.initial}</span>
  );
}

const navItems = [
  { page: "icons", label: "Icons" },
  { page: "vectors", label: "Vectors" },
  { page: "templates", label: "Templates" },
  { page: "footage", label: "Footage" },
  { page: "create", label: "Create" },
];

// The site header shared by every page; App renders it above each page.
function PageHeader({ page, setPage, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  const go = (target) => (e) => {
    e.preventDefault();
    setAccountOpen(false);
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

  const info = accountInfo(user);

  return (
    <>
      <header className="site-header">
        <a className="site-brand" href="#" onClick={go("home")} aria-label="Khulqi Design home">
          <img src="/logo.png" alt="" className="site-brand-mark" />
          <img src="/KD Logogram.png" alt="Khulqi Design" className="site-brand-word" />
        </a>

        <nav className="site-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a
              key={item.page}
              href="#"
              className={page === item.page ? "active" : ""}
              onClick={go(item.page)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="site-account">
          <a
            href="#"
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
                  <a href="#" role="menuitem" onClick={go("downloads")}>Your downloads</a>
                  <a href="#" role="menuitem" onClick={go("create")}>Your designs</a>
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
              <a href="#" className="site-login" onClick={go("login")}>Log in</a>
              <a href="#" className="site-register" onClick={go("register")}>Register</a>
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
        onLogout={onLogout}
      />
    </>
  );
}

export default PageHeader;
