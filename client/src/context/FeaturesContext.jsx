import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchFeatures } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const FeaturesContext = createContext(null);

const PREVIEW_STORAGE_KEY = 'tradescrim_admin_preview';

function readPreviewSetting() {
  try {
    return window.localStorage.getItem(PREVIEW_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

// Which flagged features (see server/src/lib/features.js) this viewer gets.
// Published ones are on for everyone. Admins also get unpublished ones while
// "preview" is on — switch it off from the Admin page to see the site exactly
// as regular users do. The server enforces the same rule on its endpoints, so
// this only decides what the UI shows.
export function FeaturesProvider({ children }) {
  const { user } = useAuth();
  const [published, setPublished] = useState([]);
  const [previewable, setPreviewable] = useState([]);
  const [previewOn, setPreviewOnState] = useState(readPreviewSetting);

  const refresh = useCallback(() => {
    return fetchFeatures()
      .then((d) => {
        setPublished(d.published || []);
        setPreviewable(d.preview || []);
      })
      .catch(() => {
        setPublished([]);
        setPreviewable([]);
      });
  }, []);

  // Refetch on login/logout, since admins get a different answer.
  useEffect(() => {
    refresh();
  }, [user?.id, refresh]);

  const setPreviewOn = useCallback((on) => {
    setPreviewOnState(on);
    try {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      // Storage blocked — the setting just won't survive a reload.
    }
  }, []);

  const isEnabled = useCallback(
    (key) => published.includes(key) || (Boolean(user?.isAdmin) && previewOn && previewable.includes(key)),
    [published, previewable, previewOn, user?.isAdmin]
  );

  // True when the feature is showing only because this admin is previewing it.
  const isPreview = useCallback((key) => isEnabled(key) && !published.includes(key), [isEnabled, published]);

  return (
    <FeaturesContext.Provider value={{ isEnabled, isPreview, previewOn, setPreviewOn, refresh }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  const ctx = useContext(FeaturesContext);
  if (!ctx) throw new Error('useFeatures must be used within a FeaturesProvider');
  return ctx;
}
