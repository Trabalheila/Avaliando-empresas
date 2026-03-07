import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import AuthLinkedIn from './pages/AuthLinkedIn';
import ChoosePseudonym from './pages/ChoosePseudonym';
import CompanyDetails from './pages/CompanyDetails';
import Purpose from './pages/Purpose';

function getPreferredTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('trabalheiLa_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function App() {
  const [theme, setTheme] = useState(getPreferredTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem('trabalheiLa_theme', theme);
  }, [theme]);

  const toggleTheme = useMemo(() => {
    return () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/auth/linkedin" element={<AuthLinkedIn />} />
      <Route path="/pseudonym" element={<ChoosePseudonym theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/empresa" element={<CompanyDetails theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/purpose" element={<Purpose theme={theme} toggleTheme={toggleTheme} />} />
    </Routes>
  );
}
export default App;
