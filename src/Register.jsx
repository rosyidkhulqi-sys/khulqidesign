import { useState } from "react";
import { supabase } from "./supabaseClient";

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
      setMessage("Cek email kamu untuk konfirmasi akun!");
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>Create Account</h2>
        {error && <p className="error-msg">{error}</p>}
        {message && <p className="success-msg">{message}</p>}
        <form onSubmit={handleRegister}>
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
            {loading ? "Loading..." : "Daftar"}
          </button>
        </form>
        <p>
          Already have an account?{" "}
          <span onClick={() => setPage("login")} className="link">
            Login
          </span>
        </p>
      </div>
    </div>
  );
}

export default Register;