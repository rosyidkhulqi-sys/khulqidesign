import { useCallback, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthLayout from "./AuthLayout";
import GoogleButton from "./GoogleButton";
import { returnPage } from "../../lib/router";

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

  // Google creates the account on first use; then back to the page that
  // asked for one, or Home
  const afterGoogle = useCallback(() => setPage(returnPage(true) ?? "home"), [setPage]);

  return (
    <AuthLayout setPage={setPage}>
      <h1>Create an account</h1>
      <p className="auth-sub">Download assets and save your designs in one place.</p>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      <GoogleButton text="signup_with" onDone={afterGoogle} onError={setError} />

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