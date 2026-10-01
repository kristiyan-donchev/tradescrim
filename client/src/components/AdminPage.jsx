import { useEffect, useState } from 'react';
import { fetchAdminFeatures, setFeaturePublished } from '../lib/api.js';
import { useFeatures } from '../context/FeaturesContext.jsx';

function formatUpdated(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AdminPage() {
  const { previewOn, setPreviewOn, refresh } = useFeatures();
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminFeatures()
      .then((f) => {
        if (!cancelled) setFeatures(f);
      })
      .catch((err) => {
        if (!cancelled) setErrorMsg(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(feature) {
    const publish = !feature.published;
    const prompt = publish
      ? `Publish "${feature.name}"? Every user will see it immediately.`
      : `Unpublish "${feature.name}"? It will be hidden from everyone except admins.`;
    if (!window.confirm(prompt)) return;
    setErrorMsg(null);
    setSavingKey(feature.key);
    try {
      setFeatures(await setFeaturePublished(feature.key, publish));
      await refresh();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <>
      <section className="panel admin-page">
        <h2>Preview mode</h2>
        <div className="settings-item">
          <div>
            <div className="settings-item-title">Show unpublished features to me</div>
            <div className="settings-item-desc">
              {previewOn
                ? "You're seeing every unpublished feature below across the site, marked with a Preview tag. Regular users don't see them."
                : "You're seeing the site exactly as regular users do — unpublished features are hidden."}
            </div>
          </div>
          <button type="button" className="secondary-button" onClick={() => setPreviewOn(!previewOn)}>
            {previewOn ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      </section>

      <section className="panel admin-page">
        <h2>Features</h2>
        {loading && <p className="empty-state">Loading features…</p>}
        {errorMsg && <div className="form-error">{errorMsg}</div>}
        {!loading && features.length === 0 && !errorMsg && (
          <p className="empty-state">No flagged features right now.</p>
        )}
        <div className="admin-feature-list">
          {features.map((f) => (
            <div className="admin-feature-row" key={f.key}>
              <div>
                <div className="admin-feature-name">
                  {f.name}
                  <span className={f.published ? 'admin-status published' : 'admin-status'}>
                    {f.published ? 'Published' : 'Unpublished'}
                  </span>
                </div>
                <div className="settings-item-desc">{f.description}</div>
                {f.updatedAt && <div className="row-subtext">Last changed {formatUpdated(f.updatedAt)}</div>}
              </div>
              <button
                type="button"
                className={f.published ? 'secondary-button' : 'primary-button'}
                onClick={() => handleToggle(f)}
                disabled={savingKey === f.key}
              >
                {savingKey === f.key ? 'Saving…' : f.published ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
