import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const MEDIA_QUERY = '(prefers-color-scheme: light)';

// Mirrors the inline favicons map in index.html's pre-paint script — kept as
// a data: URI (not a public/ file) so it needs no rebasing under `base`.
const FAVICONS: Record<Theme, string> = {
  dark: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23030C06'/><text x='16' y='21' font-family='monospace' font-size='14' font-weight='bold' text-anchor='middle' fill='%231DB954'>dA</text></svg>",
  light: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23DCD6C8'/><text x='16' y='21' font-family='monospace' font-size='14' font-weight='bold' text-anchor='middle' fill='%230B6B34'>dA</text></svg>",
};

function systemTheme(): Theme {
  return window.matchMedia(MEDIA_QUERY).matches ? 'light' : 'dark';
}

function storedTheme(): Theme | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

/**
 * Device preference wins until the user overrides it via toggleTheme, at which
 * point the choice is remembered (localStorage) and the system is ignored.
 * index.html runs the same resolution inline before paint, so there's no flash.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => storedTheme() ?? systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.getElementById('favicon')?.setAttribute('href', FAVICONS[theme]);
  }, [theme]);

  // Stay in sync with the OS as long as the user hasn't chosen explicitly.
  useEffect(() => {
    const mq = window.matchMedia(MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (storedTheme() === null) setThemeState(e.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
