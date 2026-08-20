import { lazy, Suspense, useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import TradingApp from './components/TradingApp.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';

// Most first visits land here as a guest browsing TradingApp — AuthPage's
// code (plus the legal modal text it can open) doesn't need to be part of
// that initial download until someone actually clicks "Log in".
const AuthPage = lazy(() => import('./components/AuthPage.jsx'));

export default function App() {
  const { user, checkingSession } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  // Lifted above TradingApp so the page a guest was browsing survives the
  // trip through AuthPage (which replaces TradingApp entirely while shown,
  // unmounting it — any state kept inside TradingApp itself wouldn't survive).
  const [page, setPage] = useState('dashboard');

  if (checkingSession) {
    return <LoadingScreen />;
  }

  if (!user && showAuth) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AuthPage onBack={() => setShowAuth(false)} />
      </Suspense>
    );
  }

  if (!user) {
    return <TradingApp guest onRequestLogin={() => setShowAuth(true)} page={page} setPage={setPage} />;
  }

  return <TradingApp page={page} setPage={setPage} />;
}
