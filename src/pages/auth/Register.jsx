import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthLayout, { GoogleIcon } from "./AuthLayout";

function Register({ setPage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email to confirm your account.");
    }
    setLoading(false);
  };

  // Google sign-in creates the account on first use
  const handleGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  return (
    <AuthLayout setPage={setPage}>
      <h1>Create an account</h1>
      <p className="auth-sub">Download assets and save your designs in one place.</p>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      <button type="button" onClick={handleGoogle} className="auth-google">
        <GoogleIcon /> Sign up with Google
      </button>

      <div className="auth-divider"><span>or sign up with email</span></div>

      <form onSubmit={handleRegister}>
        <label>
          Email
          <input
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="At least 6 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="auth-terms">
        By creating an account you agree to the{" "}
        <button type="button" onClick={() => setPage("terms")}>Terms</button> and{" "}
        <button type="button" onClick={() => setPage("privacy")}>Privacy Policy</button>.
      </p>

      <p className="auth-switch">
        Already have an account?{" "}
        <button type="button" onClick={() => setPage("login")}>Log in</button>
      </p>
    </AuthLayout>
  );
}

export default Register;