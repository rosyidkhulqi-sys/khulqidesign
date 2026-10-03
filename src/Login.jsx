import { useState } from "react";
import { supabase } from "./supabaseClient";

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

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>Login</h2>
        {error && <p className="error-msg">{error}</p>}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
        <p>
          Belum punya akun?{" "}
          <span onClick={() => setPage("register")} className="link">
            Daftar
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;