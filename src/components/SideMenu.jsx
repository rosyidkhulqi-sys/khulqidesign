import "./SideMenu.css";
import { accountInfo } from "../lib/account";

const menuItems = [
  { key: "ai", label: "AI" },
  { key: "icons", label: "Icons" },
  { key: "vectors", label: "Vectors" },
  { key: "logos", label: "Logos" },
  { key: "templates", label: "Templates" },
  { key: "footage", label: "Footage" },
  { key: "create", label: "Create" },
];

function SideMenu({ open, onClose, page, setPage, user, onLogout }) {
  const go = (p) => (e) => {
    e.preventDefault();
    setPage(p);
    onClose();
    window.scrollTo(0, 0);
  };

  const info = accountInfo(user);

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

        {user ? (
          <div className="sidemenu-user">
            <strong>{info.name}</strong>
            <small>{info.email}</small>
          </div>
        ) : (
          <div className="sidemenu-auth">
            <a href="#" onClick={go("login")}>Login</a>
            <a href="#" className="sidemenu-register" onClick={go("register")}>
              Register
            </a>
          </div>
        )}

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

        {user && (
          <a
            href="#"
            className="sidemenu-link sidemenu-logout"
            onClick={(e) => {
              e.preventDefault();
              onClose();
              onLogout();
            }}
          >
            Log out
          </a>
        )}
      </aside>
    </>
  );
}

export default SideMenu;
