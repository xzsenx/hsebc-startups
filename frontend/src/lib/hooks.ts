import { useEffect, useRef, useState } from "react";

/** Заголовок вкладки и перенос фокуса на заголовок страницы при переходе:
    экранный диктор сообщит, куда попал пользователь (WCAG 2.4.3). */
export function usePage(title: string) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} · Команда`;
  }, [title]);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return headingRef;
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export type ThemeChoice = "system" | "light" | "dark";

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", choice);
  } catch {
    /* noop */
  }
}

export function readTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}
