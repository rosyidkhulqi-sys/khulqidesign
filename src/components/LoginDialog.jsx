// The one "log in to continue" dialog, opened by askLogin() from anywhere.
// After logging in or signing up the visitor comes back to the same page.
import { useEffect } from "react";
import "./LoginDialog.css";

const titles = {
  download: "Log in to download",
  edit: "Log in to edit and copy",
  create: "Log in to use Create",
  ai: "Log in to use the AI tools",
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
        <h2 id="login-dialog-title">{titles[reason] ?? titles.download}</h2>
        <p>A free account is all you need. It takes a few seconds with Google.</p>
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

// in place of the Create editor for signed-out visitors
export function LoginWall({ onAuth }) {
  return (
    <section className="login-wall">
      <h1>Design with Create</h1>
      <p>
        Drag in our icons, vectors and templates, add your text, and download a
        post, poster or banner. Free with an account.
      </p>
      <div>
        <button className="login-dialog-main" onClick={() => onAuth("register")}>Create free account</button>
        <button className="login-dialog-second" onClick={() => onAuth("login")}>Log in</button>
      </div>
    </section>
  );
}

export default LoginDialog;
