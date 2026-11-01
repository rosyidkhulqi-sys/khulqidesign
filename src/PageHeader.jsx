import { useState } from "react";
import SideMenu from "./SideMenu";
import "./PageHeader.css";

const navItems = [
  { page: "icons", label: "Icons" },
  { page: "vectors", label: "Vectors" },
  { page: "templates", label: "Templates" },
  { page: "footage", label: "Footage" },
  { page: "create", label: "Create" },
];

// The site header shared by every page; App renders it above each page.
function PageHeader({ page, setPage }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (target) => (e) => {
    e.preventDefault();
    setPage(target);
    window.scrollTo(0, 0);
  };

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
          <a href="#" className="site-login" onClick={go("login")}>Log in</a>
          <a href="#" className="site-register" onClick={go("register")}>Register</a>
        </div>

        <button className="site-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <svg className="site-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} page={page} setPage={setPage} />
    </>
  );
}

export default PageHeader;
