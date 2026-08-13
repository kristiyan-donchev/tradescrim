import { useState } from 'react';
import { TERMS_SECTIONS, PRIVACY_SECTIONS, LEGAL_LAST_UPDATED } from '../lib/legal.js';
import { Icon } from './icons.jsx';

export default function LegalModal({ initialTab = 'terms', onClose }) {
  const [tab, setTab] = useState(initialTab);
  const sections = tab === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal legal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="trade-side-toggle legal-modal-tabs">
          <button
            type="button"
            className={tab === 'terms' ? 'side-button buy active' : 'side-button buy'}
            onClick={() => setTab('terms')}
          >
            Terms of Service
          </button>
          <button
            type="button"
            className={tab === 'privacy' ? 'side-button buy active' : 'side-button buy'}
            onClick={() => setTab('privacy')}
          >
            Privacy Policy
          </button>
        </div>

        <p className="row-subtext">Last updated {LEGAL_LAST_UPDATED}</p>

        {sections.map((section) => (
          <div className="learn-section" key={section.heading}>
            <h3>{section.heading}</h3>
            {section.body && <p>{section.body}</p>}
            {section.list && (
              <ul>
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <button className="secondary-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
