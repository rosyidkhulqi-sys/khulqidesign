import "./SideMenu.css";

const menuItems = [
  { key: "icons", label: "Icons" },
  { key: "vectors", label: "Vectors" },
  { key: "templates", label: "Templates" },
  { key: "video", label: "Footage" },
];

function SideMenu({ open, onClose, page, setPage }) {
  const go = (p) => (e) => {
    e.preventDefault();
    setPage(p);
    onClose();
    window.scrollTo(0, 0);
  };

  return (
    <>
      <div
        className={`sidemenu-overlay ${open ? "show" : ""}`}
        onClick={onClose}
      />

      <aside className={`sidemenu ${open ? "open" : ""}`}>
        <div className="sidemenu-top">
          <img
            src="/KD Logogram.png"
            alt="Khulqi Design"
            className="sidemenu-logo"
            onClick={go("home")}
          />
          <button className="sidemenu-close" onClick={onClose}>✕</button>
        </div>

        <div className="sidemenu-auth">
          <a href="#" onClick={go("login")}>Login</a>
          <a href="#" className="sidemenu-register" onClick={go("register")}>
            Register
          </a>
        </div>

        <p className="sidemenu-label">BROWSE</p>
        {menuItems.map((item) => (
          <a
            key={item.key}
            href="#"
            className={`sidemenu-link ${page === item.key ? "active" : ""}`}
            onClick={go(item.key)}
          >
            {item.label}
          </a>
        ))}
        
        <p className="sidemenu-label" style={{ marginTop: 24 }}>ACCOUNT</p>
        <a href="#" className={`sidemenu-link ${page === "downloads" ? "active" : ""}`} onClick={go("downloads")}>
          Your Downloads
        </a>

        <a href="#" className="sidemenu-link" onClick={go("home")}>
          Home
        </a>
      </aside>
    </>
  );
}

export default SideMenu;