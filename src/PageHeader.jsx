import { useState } from "react";
import SideMenu from "./SideMenu";

function PageHeader({ page, setPage, brand = "Khulqidesign" }) {
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
          <img
            src="/KD%20Logogram.png"
            alt="Khulqidesign"
            className="header-wordmark"
            onClick={() => setPage("home")}
          />
        </div>

        <button className="header-downloads" onClick={() => setPage("downloads")}>
          ⬇ Downloads
        </button>
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