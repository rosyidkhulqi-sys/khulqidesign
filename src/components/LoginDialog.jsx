// The one "log in to continue" dialog, opened by askLogin() from anywhere.
// After logging in or signing up the visitor comes back to the same page.
import { useEffect } from "react";
import "./LoginDialog.css";

// [title, line under it] per reason askLogin() was called with
const copy = {
  download: ["Log in to download", "A free account is all you need. It takes a few seconds with Google."],
  edit: ["Log in to download and copy", "A free account is all you need. It takes a few seconds with Google."],
  result: ["Your result is ready", "Log in or create a free account to download it. It stays here while you do."],
  design: ["Log in to download your design", "Your design is saved on this device. Log in or create a free account to download it."],
};

const perks = [
  "10 free downloads every day",
  "Edit icons, design in Create, try the AI tools",
  "Your download history on every device",
];

function LoginDialog({ reason, onAuth, onClose }) {
  // Escape closes, as every dialog on the site does
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="login-dialog-backdrop" onClick={onClose}>
      <div className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-dialog-title"
           onClick={(e) => e.stopPropagation()}>
        <button className="login-dialog-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 id="login-dialog-title">{(copy[reason] ?? copy.download)[0]}</h2>
        <p>{(copy[reason] ?? copy.download)[1]}</p>
        <ul>
          {perks.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <button className="login-dialog-main" onClick={() => onAuth("register")}>Create free account</button>
        <button className="login-dialog-second" onClick={() => onAuth("login")}>I already have an account</button>
        <button className="login-dialog-link" onClick={() => onAuth("pricing")}>See Premium plans</button>
      </div>
    </div>
  );
}

export default LoginDialog;
