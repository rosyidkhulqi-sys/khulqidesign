import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthLayout, { GoogleIcon } from "./AuthLayout";

function Login({ setPage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setPage("home");
    }

    setLoading(false);
  };
  
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
      <h1>Log in</h1>
      <p className="auth-sub">Welcome back. Log in to continue to Khulqidesign.</p>

      {error && <p className="auth-error">{error}</p>}

      <button type="button" onClick={handleGoogle} className="auth-google">
        <GoogleIcon /> Continue with Google
      </button>

      <div className="auth-divider"><span>or log in with email</span></div>

      <form onSubmit={handleLogin}>
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
            placeholder="Your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="auth-switch">
        Don't have an account?{" "}
        <button type="button" onClick={() => setPage("register")}>Sign up</button>
      </p>
    </AuthLayout>
  );
}

export default Login;