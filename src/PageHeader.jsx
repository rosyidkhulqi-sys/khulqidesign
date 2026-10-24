import { useState } from "react";
import SideMenu from "./SideMenu";

function PageHeader({ page, setPage, title, subtitle }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="page-header">
        <div className="header-left">
          <button className="menu-btn" onClick={() => setMenuOpen(true)}>
            ☰ Menu
          </button>
          <img
            src="/logo1.png"
            alt="Khulqi Design"
            className="header-logo"
            onClick={() => setPage("home")}
          />
        </div>

        <button className="header-downloads" onClick={() => setPage("downloads")}>
          ⬇ Downloads
        </button>
      </div>

      <div className="page-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        page={page}
        setPage={setPage}
      />
    </>
  );
}

export default PageHeader;