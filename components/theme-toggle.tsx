'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('edgewake-theme', theme);
  window.dispatchEvent(new Event('edgewake-theme-change'));
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('edgewake-theme');
    const initialTheme: Theme =
      savedTheme === 'dark' || savedTheme === 'light'
        ? savedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    applyTheme(initialTheme);
    const animation = requestAnimationFrame(() => setTheme(initialTheme));

    return () => cancelAnimationFrame(animation);
  }, []);

  const isDark = theme === 'dark';
  const nextTheme: Theme = isDark ? 'light' : 'dark';

  return (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={isDark}
      className="edge-theme-toggle"
      onClick={() => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      title={`Switch to ${nextTheme} mode`}
      type="button"
    >
      {isDark ? <Sun strokeWidth={1.65} /> : <Moon strokeWidth={1.65} />}
    </button>
  );
}
