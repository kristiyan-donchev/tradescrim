import { Icon } from './icons.jsx';

// Shared chrome every game wraps its content in — back button + title, so
// individual games only have to build their actual gameplay.
export default function GameShell({ title, onExit, children }) {
  return (
    <div className="game-shell">
      <button type="button" className="game-back-button" onClick={onExit}>
        <Icon name="arrow-left" size={14} /> Back to Games
      </button>
      <section className="panel game-panel">
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
