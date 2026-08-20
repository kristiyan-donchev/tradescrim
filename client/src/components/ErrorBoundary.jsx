import { Component } from 'react';

const RELOAD_FLAG_KEY = 'tradescrim-chunk-reload-attempted';

function isChunkLoadError(error) {
  const message = error?.message || '';
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

// Without this, any render error anywhere in the tree — including a lazy()
// chunk failing to load — unmounts the entire app to a blank page, since
// Suspense doesn't catch a rejected import itself; it just re-throws on the
// next render for the nearest error boundary to handle. Code-splitting the
// app by page/chart introduced that failure mode: a tab left open across a
// deploy can hold chunk URLs a newer build has since replaced with
// different content-hashed filenames, so the very next lazy import 404s.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Reloading once picks up the current index.html and its correct chunk
    // URLs, silently fixing the stale-deploy case instead of leaving the
    // user on a blank screen. Gated by a one-shot sessionStorage flag so a
    // genuinely broken build (not just a stale cache) shows the fallback
    // below instead of reload-looping forever.
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG_KEY)) {
      sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-screen">
          <h1>Something went wrong</h1>
          <p>Try reloading the page. If that doesn't fix it, check back in a few minutes.</p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
