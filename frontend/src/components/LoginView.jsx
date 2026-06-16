import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function LoginView({ onSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(email.trim(), password.trim());
      login(data);
      onSuccess(data.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="brand-section">
          <img src="/logo.png" alt="Harvest International School" className="brand-logo-img" />
          <div className="brand-tagline">Academic Quality Audit</div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="field-label">Email Address</label>
            <input
              type="email"
              className="input-text"
              placeholder="name@harvest.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="field-label">Password</label>
            <input
              type="password"
              className="input-text"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn-submit-large" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
