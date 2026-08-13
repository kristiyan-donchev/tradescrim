import { useState } from 'react';
import { GLOSSARY_TERMS } from '../lib/glossary.js';
import { Icon } from './icons.jsx';
import LegalModal from './LegalModal.jsx';

export default function Onboarding({ onClose }) {
  const [legalTab, setLegalTab] = useState(null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Welcome to TradeScrim</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <p>
          This is a <strong>paper-trading simulator</strong>: you practice buying and selling{' '}
          <strong>real stocks and cryptocurrencies at real (delayed) market prices</strong>, using{' '}
          <strong>pretend money</strong>. No real trades are ever placed, and no brokerage account
          is connected. It's a safe place to learn how investing works.
        </p>

        <h3>How to use it</h3>
        <ol>
          <li>You start with $10,000 in virtual cash.</li>
          <li>Search for a company, ticker, or cryptocurrency (like AAPL, TSLA, or Bitcoin).</li>
          <li>Look at its current price and recent price chart.</li>
          <li>Place a simulated "buy" or "sell" market order.</li>
          <li>Track your holdings, profit/loss, and full transaction history any time.</li>
        </ol>

        <h3>A few beginner terms</h3>
        <dl className="glossary">
          {GLOSSARY_TERMS.map((t) => (
            <div key={t.term} className="glossary-item">
              <dt>{t.term}</dt>
              <dd>{t.text}</dd>
            </div>
          ))}
        </dl>

        <button className="primary-button" onClick={onClose}>
          Got it, let's start
        </button>

        <p className="disclaimer-inline">
          <button type="button" className="link-button" onClick={() => setLegalTab('terms')}>
            Terms of Service
          </button>{' '}
          ·{' '}
          <button type="button" className="link-button" onClick={() => setLegalTab('privacy')}>
            Privacy Policy
          </button>
        </p>
      </div>

      {legalTab && <LegalModal initialTab={legalTab} onClose={() => setLegalTab(null)} />}
    </div>
  );
}
