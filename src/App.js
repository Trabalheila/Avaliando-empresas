import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import Home from './Home';
import './i18n';
import { useTranslation } from 'react-i18next';
import AuthLinkedIn from './pages/AuthLinkedIn';
import ChoosePseudonym from './pages/ChoosePseudonym';
import CompanyDetails from './pages/CompanyDetails';
import CompanyItemComments from './pages/CompanyItemComments';
import Purpose from './pages/Purpose';
import DeleteData from './pages/DeleteData';

const DEFAULT_ROUTE_TRANSITION = {
  durationMs: 320,
  easing: 'cubic-bezier(0.22, 0.9, 0.2, 1)',
};

const ROUTE_TRANSITION_PRESETS = {
  home: { durationMs: 220, easing: 'cubic-bezier(0.24, 0.86, 0.24, 1)' },
  company: { durationMs: 460, easing: 'cubic-bezier(0.14, 0.96, 0.2, 1)' },
  profile: { durationMs: 340, easing: 'cubic-bezier(0.22, 0.9, 0.2, 1)' },
  purpose: { durationMs: 300, easing: 'cubic-bezier(0.2, 0.88, 0.24, 1)' },
  auth: { durationMs: 280, easing: 'cubic-bezier(0.2, 0.88, 0.24, 1)' },
};

function getTransitionDurationMs() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_ROUTE_TRANSITION.durationMs;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : DEFAULT_ROUTE_TRANSITION.durationMs;
}

function getRouteTransitionProfile(pathname) {
  const baseDuration = getTransitionDurationMs();
  if (baseDuration === 0) return { durationMs: 0, easing: 'linear' };

  const path = pathname || '/';

  if (path === '/') {
    return ROUTE_TRANSITION_PRESETS.home;
  }

  if (path.startsWith('/empresa')) {
    return ROUTE_TRANSITION_PRESETS.company;
  }

  if (path.startsWith('/pseudonym')) {
    return ROUTE_TRANSITION_PRESETS.profile;
  }

  if (path.startsWith('/purpose')) {
    return ROUTE_TRANSITION_PRESETS.purpose;
  }

  if (path.startsWith('/excluir-dados')) {
    return ROUTE_TRANSITION_PRESETS.purpose;
  }

  if (path.startsWith('/auth')) {
    return ROUTE_TRANSITION_PRESETS.auth;
  }

  return { durationMs: baseDuration, easing: DEFAULT_ROUTE_TRANSITION.easing };
}

function getPreferredTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('trabalheiLa_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  // Valor padrão: dia (azul claro). Não seguimos o esquema de cores do sistema automaticamente.
  return 'light';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}


function getPreferredLanguage() {
  if (typeof window === 'undefined') return 'pt';
  const stored = window.localStorage.getItem('trabalheiLa_lang');
  if (stored) return stored;
  return 'pt';
}

function App() {
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [theme, setTheme] = useState(getPreferredTheme);
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('i18nextLng') || getPreferredLanguage();
  });
  const [currentLocation, setCurrentLocation] = useState(location);
  const [outgoingLocation, setOutgoingLocation] = useState(null);
  const [incomingLocation, setIncomingLocation] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState('forward');
  const initialProfile = useMemo(() => getRouteTransitionProfile(location.pathname), [location.pathname]);
  const [transitionDurationMs, setTransitionDurationMs] = useState(initialProfile.durationMs);
  const [transitionEasing, setTransitionEasing] = useState(initialProfile.easing);
  const transitionTimeoutRef = useRef(null);


  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem('trabalheiLa_theme', theme);
  }, [theme]);


  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
    window.localStorage.setItem('i18nextLng', language);
  }, [language, i18n]);

  const toggleTheme = useMemo(() => {
    return () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    const currentKey = `${currentLocation.pathname}${currentLocation.search}`;
    const nextKey = `${location.pathname}${location.search}`;
    if (currentKey === nextKey) return;

    const direction = navigationType === 'POP' ? 'back' : 'forward';
    const profile = getRouteTransitionProfile(location.pathname);

    setTransitionDurationMs(profile.durationMs);
    setTransitionEasing(profile.easing);
    setTransitionDirection(direction);
    setOutgoingLocation(currentLocation);
    setIncomingLocation(location);
    setIsTransitioning(true);

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    const duration = profile.durationMs;
    if (duration === 0) {
      setCurrentLocation(location);
      setOutgoingLocation(null);
      setIncomingLocation(location);
      setIsTransitioning(false);
      return;
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setCurrentLocation(location);
      setOutgoingLocation(null);
      setIncomingLocation(location);
      setIsTransitioning(false);
    }, duration);
  }, [location, navigationType, currentLocation]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const renderRoutes = (routeLocation) => (
    <Routes location={routeLocation}>
      <Route path="/" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/auth/linkedin" element={<AuthLinkedIn />} />
      <Route path="/pseudonym" element={<ChoosePseudonym theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/empresa" element={<CompanyDetails theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/empresa/comentarios-item" element={<CompanyItemComments theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/purpose" element={<Purpose theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/excluir-dados" element={<DeleteData theme={theme} toggleTheme={toggleTheme} />} />
    </Routes>
  );


  return (
    <>

      <div
        className="route-transition-stage"
        style={{
          '--route-transition-ms': `${transitionDurationMs}ms`,
          '--route-transition-ease': transitionEasing,
        }}
      >
        {isTransitioning && outgoingLocation ? (
          <>
            <div
              key={`out-${outgoingLocation.pathname}${outgoingLocation.search}`}
              className={`route-layer route-layer-exit ${
                transitionDirection === 'back' ? 'route-exit-back' : 'route-exit-forward'
              }`}
            >
              {renderRoutes(outgoingLocation)}
            </div>
            <div
              key={`in-${incomingLocation.pathname}${incomingLocation.search}`}
              className={`route-layer route-layer-enter ${
                transitionDirection === 'back' ? 'route-enter-back' : 'route-enter-forward'
              }`}
            >
              {renderRoutes(incomingLocation)}
            </div>
          </>
        ) : (
          <div className="route-layer route-layer-steady">
            {renderRoutes(currentLocation)}
          </div>
        )}
      </div>
    </>
  );
}
export default App;
