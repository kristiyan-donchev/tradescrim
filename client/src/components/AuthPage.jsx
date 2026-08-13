import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './icons.jsx';
import { GOOGLE_AUTH_URL } from '../lib/api.js';
import LegalModal from './LegalModal.jsx';

export default function AuthPage({ onBack }) {
  const [mode, setMode] = useState('login');
  const [legalTab, setLegalTab] = useState(null);
  const { login, signup } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Honeypot: a field real users never see or fill, but naive signup bots
  // that blindly fill every form input will. Left non-empty, the server
  // silently no-ops the signup instead of flagging it, since a genuine user
  // should never be able to trigger it in the first place.
  const [website, setWebsite] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('authError') === 'google') {
      setError('Google sign-in failed. Please try again.');
      params.delete('authError');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ username, password });
      } else {
        await signup({ username, email, password, website });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError(null);
    setPassword('');
  }

  return (
    <div className="app auth-page">
      <div className="panel auth-panel">
        {onBack && (
          <button type="button" className="auth-back-link" onClick={onBack}>
            <Icon name="arrow-left" size={14} /> Continue browsing
          </button>
        )}
        <h1>TradeScrim</h1>
        <p className="tagline">Practice trading with real market prices — using 100% virtual money.</p>

        <div className="trade-side-toggle">
          <button
            type="button"
            className={mode === 'login' ? 'side-button buy active' : 'side-button buy'}
            onClick={() => switchMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'side-button buy active' : 'side-button buy'}
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          {mode === 'signup' && (
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
          )}

          {mode === 'signup' && (
            <label className="honeypot-field" aria-hidden="true">
              <span>Website</span>
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          )}

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
            {mode === 'signup' && <span className="field-hint">At least 8 characters, with a letter and a number.</span>}
          </label>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <a href={GOOGLE_AUTH_URL} className="google-button">
          <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z"
            />
          </svg>
          Continue with Google
        </a>

        <p className="disclaimer-inline">
          TradeScrim is a paper-trading simulator — there is no real money or brokerage account involved.
          By continuing, you agree to our{' '}
          <button type="button" className="link-button" onClick={() => setLegalTab('terms')}>
            Terms of Service
          </button>{' '}
          and{' '}
          <button type="button" className="link-button" onClick={() => setLegalTab('privacy')}>
            Privacy Policy
          </button>
          .
        </p>
      </div>

      {legalTab && <LegalModal initialTab={legalTab} onClose={() => setLegalTab(null)} />}
    </div>
  );
}
