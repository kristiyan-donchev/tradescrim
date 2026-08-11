import { useState } from 'react';
import { resendVerificationEmail } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './icons.jsx';

// Shown for any logged-in, password-based account that hasn't clicked its
// verification link yet — Google accounts are marked verified at signup
// (see createGoogleUser) and never see this. Doesn't block anything in the
// app; it's a nudge, not a gate, since locking out a legitimate user over
// an email delivery hiccup would be worse than the risk it's guarding against.
export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.emailVerified || !user.hasPassword || dismissed) return null;

  async function handleResend() {
    setStatus('sending');
    try {
      await resendVerificationEmail();
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="verify-email-banner">
      <span>
        Verify your email ({user.email}) to secure your account.
        {status === 'sent' && ' Check your inbox for the link.'}
        {status === 'error' && " Couldn't send it — try again in a moment."}
      </span>
      <div className="verify-email-banner-actions">
        <button type="button" className="link-button" onClick={handleResend} disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Resend email'}
        </button>
        <button type="button" className="icon-button" onClick={() => setDismissed(true)} title="Dismiss">
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}
