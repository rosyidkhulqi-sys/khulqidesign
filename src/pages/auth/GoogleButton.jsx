// "Continue with Google" through Google Identity Services, on our own page:
// Google's window then names khulqidesign.com instead of the Supabase
// server. Google hands back an ID token, which Supabase turns into a
// session (signInWithIdToken). A nonce ties that token to this click.
//
// Needs https://khulqidesign.com (and http://localhost:5173 for development)
// in the OAuth client's "Authorized JavaScript origins" in Google Cloud.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const CLIENT_ID = "19590224341-05hgkpt7sngupqvmjqls7h7ep1p0o76i.apps.googleusercontent.com";
const SCRIPT = "https://accounts.google.com/gsi/client";

let scriptPromise;
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Google sign-in couldn't load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// a random nonce, and its SHA-256 (Google gets the hash, Supabase the original)
async function makeNonce() {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hex };
}

// text: "continue_with" | "signup_with"; onDone() after the session starts;
// onError(message) when something fails
function GoogleButton({ text = "continue_with", onDone, onError }) {
  const box = useRef(null);
  const [failed, setFailed] = useState(false);
  // the latest callbacks, so the button is set up once and its nonce stays
  // the same while Google's window is open
  const done = useRef(onDone);
  const fail = useRef(onError);
  useEffect(() => {
    done.current = onDone;
    fail.current = onError;
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadScript(), makeNonce()])
      .then(([google, nonce]) => {
        if (cancelled || !box.current) return;
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: nonce.hex,
          use_fedcm_for_prompt: true,
          callback: async ({ credential }) => {
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: credential,
              nonce: nonce.raw,
            });
            if (error) fail.current?.(error.message);
            else done.current?.();
          },
        });
        google.accounts.id.renderButton(box.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "center",
          // the site is in English, whatever the browser language
          locale: "en",
          width: Math.min(400, box.current.offsetWidth || 360),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (failed) {
    return <p className="auth-error">Google sign-in couldn't load. Check your connection, or use email below.</p>;
  }
  return <div ref={box} className="auth-google-box" />;
}

export default GoogleButton;
