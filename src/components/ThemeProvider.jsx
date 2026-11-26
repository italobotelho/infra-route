import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS, getStorageItem, setStorageItem } from "../utils/storage";

const ThemeContext = createContext(null);

function resolveInitialTheme() {
  const stored = getStorageItem(STORAGE_KEYS.UI_THEME, null);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function applyThemeToDom(theme) {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);

  useEffect(() => {
    applyThemeToDom(theme);
    setStorageItem(STORAGE_KEYS.UI_THEME, theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(nextTheme === "dark" ? "dark" : "light");
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((curr) => (curr === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "light",
      isDark: false,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}

function ThemeIcon({ isDark, className = "h-4 w-4" }) {
  if (isDark) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ThemeToggle({ variant = "sidebar", collapsed = false, className = "" }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Modo Claro" : "Modo Escuro";
  const nextHint = isDark ? "Alternar para tema claro" : "Alternar para tema escuro";

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-pressed={isDark}
        aria-label={nextHint}
        title={nextHint}
        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-slate-300/80 bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md transition hover:border-blue-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-800 ${className}`.trim()}
      >
        <ThemeIcon isDark={isDark} className="h-3.5 w-3.5 text-amber-500 dark:text-sky-300" />
        <span>{label}</span>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-pressed={isDark}
        aria-label={nextHint}
        title={nextHint}
        className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-100 transition hover:bg-slate-700 ${className}`.trim()}
      >
        <ThemeIcon isDark={isDark} className="h-4 w-4 text-amber-300" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={nextHint}
      title={nextHint}
      className={`flex w-full cursor-pointer items-center rounded-lg border border-slate-700/80 bg-slate-800/60 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white ${
        collapsed ? "justify-center px-2" : "justify-between px-3 text-left"
      } ${className}`.trim()}
    >
      {collapsed ? (
        <ThemeIcon isDark={isDark} className="h-4 w-4 text-amber-300" />
      ) : (
        <>
          <span className="inline-flex items-center gap-2">
            <ThemeIcon isDark={isDark} className="h-4 w-4 text-amber-300" />
            <span>{label}</span>
          </span>
          <span className="rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
            {isDark ? "ON" : "OFF"}
          </span>
        </>
      )}
    </button>
  );
}
