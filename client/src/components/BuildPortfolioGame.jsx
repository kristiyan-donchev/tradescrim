import { useMemo, useState } from 'react';
import GameShell from './GameShell.jsx';
import { submitGameResult } from '../lib/api.js';

const UNITS_TOTAL = 10;

// Stylized risk archetypes rather than live quotes — the point is practicing
// the *tradeoff* (higher average risk vs. spreading across more categories),
// not reacting to today's market.
const ASSETS = [
  { id: 'large-cap', name: 'US Large-Cap Stocks', risk: 2 },
  { id: 'growth-tech', name: 'Growth Tech Stocks', risk: 4 },
  { id: 'gov-bonds', name: 'Government Bonds', risk: 1 },
  { id: 'corp-bonds', name: 'Corporate Bonds', risk: 2 },
  { id: 'reit', name: 'Real Estate (REIT)', risk: 3 },
  { id: 'emerging', name: 'Emerging Markets', risk: 4 },
  { id: 'crypto', name: 'Cryptocurrency', risk: 5 },
  { id: 'gold', name: 'Gold', risk: 2 },
];

function randomTarget() {
  const targetRisk = Math.round((2 + Math.random() * 2) * 10) / 10; // 2.0-4.0
  const minCategories = 3 + Math.floor(Math.random() * 2); // 3 or 4
  return { targetRisk, minCategories };
}

function emptyAllocation() {
  return Object.fromEntries(ASSETS.map((a) => [a.id, 0]));
}

export default function BuildPortfolioGame({ guest, onExit, onScoreSaved }) {
  const [target] = useState(randomTarget);
  const [allocation, setAllocation] = useState(emptyAllocation);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [score, setScore] = useState(0);
  const [resultDetail, setResultDetail] = useState('');

  const used = Object.values(allocation).reduce((a, b) => a + b, 0);
  const remaining = UNITS_TOTAL - used;

  const weightedRisk = useMemo(() => {
    if (used === 0) return 0;
    const sum = ASSETS.reduce((acc, a) => acc + allocation[a.id] * a.risk, 0);
    return sum / used;
  }, [allocation, used]);

  function adjust(id, delta) {
    setAllocation((prev) => {
      const next = Math.max(0, Math.min(UNITS_TOTAL, prev[id] + delta));
      if (delta > 0 && remaining <= 0) return prev;
      return { ...prev, [id]: next };
    });
  }

  function submit() {
    const categoriesUsed = ASSETS.filter((a) => allocation[a.id] > 0).length;
    const riskDistance = Math.abs(weightedRisk - target.targetRisk);
    const riskScore = Math.max(0, 100 - riskDistance * 40);
    const diversificationPenalty = Math.max(0, target.minCategories - categoriesUsed) * 15;
    const finalScore = Math.max(0, Math.min(100, Math.round(riskScore - diversificationPenalty)));

    setScore(finalScore);
    setResultDetail(
      `Average risk ${weightedRisk.toFixed(1)} (target ${target.targetRisk}) across ${categoriesUsed} asset ${
        categoriesUsed === 1 ? 'type' : 'types'
      } (target ${target.minCategories}+).`
    );
    setDone(true);
    if (!guest) {
      setSaving(true);
      submitGameResult('build-a-portfolio', finalScore)
        .then(() => onScoreSaved())
        .catch(() => {})
        .finally(() => setSaving(false));
    }
  }

  function playAgain() {
    setAllocation(emptyAllocation());
    setDone(false);
    onExit();
  }

  if (done) {
    return (
      <GameShell title="Build a Portfolio" onExit={onExit}>
        <div className="game-result">
          <div className="game-result-label">Score</div>
          <div className={`game-result-score ${score >= 60 ? 'positive' : 'negative'}`}>{score}/100</div>
          <p className="game-result-detail">{resultDetail}</p>
          <div className="game-actions">
            <button type="button" className="primary-button" onClick={playAgain}>
              Play again
            </button>
            <button type="button" className="secondary-button" onClick={onExit}>
              Back to Games
            </button>
          </div>
          {saving && <p className="empty-state">Saving score…</p>}
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell title="Build a Portfolio" onExit={onExit}>
      <p className="learn-lesson-summary">
        Target: average risk near <strong>{target.targetRisk}</strong> (1 = safest, 5 = riskiest), spread across
        at least <strong>{target.minCategories}</strong> asset types. Allocate all {UNITS_TOTAL} units.
      </p>

      <div className="portfolio-status">
        <span>
          Remaining units: <strong>{remaining}</strong>
        </span>
        <span>
          Current average risk: <strong>{weightedRisk.toFixed(1)}</strong>
        </span>
      </div>

      <div className="portfolio-assets">
        {ASSETS.map((asset) => (
          <div className="portfolio-asset-row" key={asset.id}>
            <div className="portfolio-asset-info">
              <span className="portfolio-asset-name">{asset.name}</span>
              <span className="portfolio-asset-risk">Risk {asset.risk}/5</span>
            </div>
            <div className="portfolio-asset-controls">
              <button type="button" className="icon-button" onClick={() => adjust(asset.id, -1)}>
                −
              </button>
              <span className="portfolio-asset-units">{allocation[asset.id]}</span>
              <button type="button" className="icon-button" onClick={() => adjust(asset.id, 1)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="game-actions" style={{ marginTop: 16 }}>
        <button type="button" className="primary-button" disabled={remaining !== 0} onClick={submit}>
          {remaining === 0 ? 'Submit portfolio' : `Allocate ${remaining} more unit${remaining === 1 ? '' : 's'}`}
        </button>
      </div>
    </GameShell>
  );
}
