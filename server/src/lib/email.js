const RESEND_API_URL = 'https://api.resend.com/emails';

// Resend's sandbox sender works out of the box with no domain setup, but can
// only deliver to the account owner's own verified address — fine for
// getting this running immediately. Once a sending domain is verified in the
// Resend dashboard, set EMAIL_FROM to an address on it (e.g.
// noreply@tradescrim.com) to actually deliver to real users.
const EMAIL_FROM = process.env.EMAIL_FROM || 'TradeScrim <onboarding@resend.dev>';

// Same "throw a clear error, let the route catch it" pattern as
// news.js's requireApiKey — keeps the missing-config message specific in
// server logs without leaking setup details to the client.
function requireApiKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      'Email is unavailable: RESEND_API_KEY is not set. Get a free key at https://resend.com.'
    );
  }
  return key;
}

async function sendEmail({ to, subject, html }) {
  const apiKey = requireApiKey();
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend request failed (${res.status}): ${body}`);
  }
}

export async function sendVerificationEmail(email, verifyUrl) {
  await sendEmail({
    to: email,
    subject: 'Verify your TradeScrim email',
    html: `
      <p>Welcome to TradeScrim! Confirm this is your email address to finish setting up your account.</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>This link expires in 24 hours. If you didn't sign up for TradeScrim, you can ignore this email.</p>
    `,
  });
}
