import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const systemPrefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolve = (themeValue) =>
  themeValue === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : themeValue;

// theme is the user's choice: 'light' | 'dark' | 'system' (persisted).
// resolvedTheme is what's actually on screen after applying the OS preference.
// The <html> class is also set pre-paint by an inline script in index.html.
export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('theme');
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
  });

  // Computed synchronously so the toggle icon is correct on first render
  const [resolvedTheme, setResolvedTheme] = useState(() => resolve(theme));

  const applyTheme = useCallback((themeValue) => {
    const resolved = resolve(themeValue);
    setResolvedTheme(resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, []);

  // Keep the <html> class in sync with the chosen theme
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Follow OS preference while set to 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  const setTheme = useCallback((newTheme) => {
    if (!['light', 'dark', 'system'].includes(newTheme)) return;
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
