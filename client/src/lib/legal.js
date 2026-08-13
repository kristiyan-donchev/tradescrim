// Terms of Service and Privacy Policy content for the Legal modal. Kept as
// structured data (mirroring lessons.js/glossary.js) so the modal component
// stays a dumb renderer and the actual legal copy lives in one place.
//
// This describes TradeScrim as it actually works today (paper-trading
// simulator, Google OAuth, Google AdSense, Yahoo Finance data via
// yahoo-finance2, Resend for transactional email) — update it if any of
// those integrations or data practices change.

export const LEGAL_LAST_UPDATED = 'August 13, 2026';

export const TERMS_SECTIONS = [
  {
    heading: '1. Acceptance of these terms',
    body: 'By creating an account or using TradeScrim, you agree to these Terms of Service and the Privacy Policy. If you don\'t agree, don\'t use the app.',
  },
  {
    heading: '2. What TradeScrim is (and isn\'t)',
    body: 'TradeScrim is an educational paper-trading simulator. Prices are real (delayed) market data, but every dollar you trade with is virtual — no real money, bank account, or brokerage is ever connected, and no real trades are ever placed. TradeScrim is not a broker-dealer, is not registered with any financial regulator, and does not hold, transmit, or manage real funds or securities.',
  },
  {
    heading: '3. Not financial, investment, tax, or legal advice',
    body: 'Nothing in TradeScrim — including lessons, quizzes, games, leaderboards, or anything else in the app — is financial, investment, tax, or legal advice. It\'s a learning tool. Performance inside the simulator (good or bad) says nothing about how any real investment would perform, and you shouldn\'t make real financial decisions based on it. Consult a licensed professional before making real investment decisions.',
  },
  {
    heading: '4. Eligibility and your account',
    body: 'You must be at least 13 years old to create an account. You\'re responsible for keeping your password confidential and for all activity under your account. Provide accurate signup information, and let us know if you believe your account has been compromised. You can delete your account at any time from account settings, which permanently removes your portfolio, transaction history, and profile data.',
  },
  {
    heading: '5. Market data and content',
    body: 'Price and market data comes from third-party sources (currently Yahoo Finance, via an unofficial community library) that can be delayed, incomplete, or occasionally wrong or unavailable. We don\'t guarantee the accuracy, completeness, or timeliness of any price, quote, chart, or news content shown in the app.',
  },
  {
    heading: '6. Acceptable use',
    list: [
      'No scraping, automated account creation, or bulk data extraction from the app or its API.',
      'No attempting to circumvent rate limits, security measures, or per-user data access controls.',
      'No manipulating leaderboards, challenges, or achievements through exploits, multiple accounts, or coordinated fake trading.',
      'No impersonating others, uploading abusive content, or using usernames/bug reports to harass other users.',
      'No attempting to disrupt, overload, or reverse-engineer the service beyond what\'s needed for ordinary use.',
    ],
  },
  {
    heading: '7. Your content',
    body: 'You retain ownership of anything you submit (like bug reports or your chosen username), but grant us a license to store, display, and use it as needed to operate the app — for example, showing your username on the leaderboard or reviewing a bug report you filed.',
  },
  {
    heading: '8. Service availability and changes',
    body: 'TradeScrim is provided on an "as is" and "as available" basis, run largely as a personal/hobby project. We may modify, suspend, or discontinue any part of the app at any time, and we don\'t guarantee uninterrupted or error-free operation.',
  },
  {
    heading: '9. Limitation of liability',
    body: 'To the fullest extent permitted by law, TradeScrim and its operator aren\'t liable for any indirect, incidental, or consequential damages arising from your use of the app, including reliance on any price, data, or content shown in it. Since no real money ever moves through the app, there\'s no real financial loss that TradeScrim itself can cause — but this disclaimer still covers things like data loss or service interruption.',
  },
  {
    heading: '10. Termination',
    body: 'We may suspend or terminate accounts that violate these terms, attempt to abuse or disrupt the service, or for other legitimate operational reasons. You can stop using the app and delete your account at any time.',
  },
  {
    heading: '11. Changes to these terms',
    body: `We may update these terms from time to time. Continuing to use TradeScrim after a change means you accept the updated terms. This version was last updated ${LEGAL_LAST_UPDATED}.`,
  },
  {
    heading: '12. Contact',
    body: 'Questions about these terms? Reach out via the "Report a bug" form in the app, or email legal@tradescrim.com.',
  },
];

export const PRIVACY_SECTIONS = [
  {
    heading: '1. Overview',
    body: 'This policy explains what information TradeScrim collects, why, and how it\'s used. TradeScrim is a paper-trading simulator — we collect the minimum needed to run accounts, portfolios, and the social features (leaderboards, friends, challenges), plus what\'s needed to keep the service secure.',
  },
  {
    heading: '2. Information we collect',
    list: [
      'Account info: username, email address, and a password — your password is hashed (bcrypt) and we never store or can see the plain-text version.',
      'Google sign-in (optional): if you use "Continue with Google," we receive your email, name, and profile picture from Google to create or match your account. We don\'t receive your Google password.',
      'Simulated trading data: your virtual portfolio, holdings, orders, and transaction history — all fictional, none of it reflects real money or real trades.',
      'Content you submit: bug reports, your username, and any friend connections you make.',
      'Technical data: your IP address (used for rate-limiting and abuse prevention on login/signup) and basic request metadata like browser user-agent.',
      'Cookies: a single httpOnly session cookie used to keep you signed in. We don\'t use it for tracking or advertising ourselves.',
    ],
  },
  {
    heading: '3. How we use your information',
    list: [
      'To create and secure your account, and keep you signed in.',
      'To operate the app\'s features — portfolio tracking, leaderboards, friends, challenges, price alerts, and achievements.',
      'To send transactional email (like email verification) via our email provider.',
      'To detect and prevent abuse, fraud, and automated account creation.',
    ],
  },
  {
    heading: '4. Advertising (Google AdSense)',
    body: 'TradeScrim shows ads served by Google AdSense. Google may use cookies or device identifiers to serve and personalize ads based on your visits to this and other sites. We don\'t control what Google collects for ad personalization — see Google\'s own Privacy Policy and Ads Settings (adssettings.google.com) to view or opt out of personalized advertising.',
  },
  {
    heading: '5. Third-party services we use',
    list: [
      'Yahoo Finance (via an unofficial data library) — provides market price/quote/chart/news data. No personal account information is sent to this source.',
      'Google OAuth — used only if you choose "Continue with Google."',
      'Google AdSense — serves ads on the site (see above).',
      'Our transactional email provider — used to deliver verification emails; your email address is shared with them solely to send that email.',
      'Our database and hosting providers — store account and app data on our behalf; they don\'t use it for their own purposes.',
    ],
  },
  {
    heading: '6. Data retention and deletion',
    body: 'We keep your account data for as long as your account exists. Deleting your account (available anytime in account settings) permanently removes your profile, portfolio, transaction history, watchlist, and friend connections from our database.',
  },
  {
    heading: '7. Your choices',
    list: [
      'Update your username or password at any time from account settings.',
      'Delete your account and its data at any time.',
      'Opt out of personalized advertising via Google\'s Ads Settings.',
      'Contact us to ask what data we hold about you or to request its deletion.',
    ],
  },
  {
    heading: '8. Data security',
    body: 'Passwords are hashed with bcrypt, sessions use httpOnly/secure cookies, and per-account data is scoped server-side so one account can\'t read another\'s data. That said, TradeScrim is a personal/hobby project and hasn\'t undergone a professional third-party security audit — please don\'t reuse a sensitive password here, and avoid sharing information you wouldn\'t want stored in a non-enterprise-grade system.',
  },
  {
    heading: '9. Children\'s privacy',
    body: 'TradeScrim isn\'t directed at children under 13, and we don\'t knowingly collect personal information from anyone under 13. If you believe a child has created an account, contact us and we\'ll delete it.',
  },
  {
    heading: '10. International users',
    body: 'TradeScrim\'s servers and data storage may be located in a different country than you. By using the app, you understand your information may be processed outside your home country.',
  },
  {
    heading: '11. Changes to this policy',
    body: `We may update this policy from time to time; the "last updated" date below will reflect the latest change. This version was last updated ${LEGAL_LAST_UPDATED}.`,
  },
  {
    heading: '12. Contact',
    body: 'Questions about this policy, or want to exercise a privacy right described above? Email privacy@tradescrim.com, or use the "Report a bug" form in the app.',
  },
];
