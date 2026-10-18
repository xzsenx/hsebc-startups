import { CircleUserRound, Inbox, LayoutGrid, LogIn, Monitor, Moon, PlusCircle, Sun, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { applyTheme, readTheme, type ThemeChoice } from "../lib/hooks";
import { bindTelegramBackButton, initTelegram } from "../lib/telegram";

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "Тема: как в системе",
  light: "Тема: светлая",
  dark: "Тема: тёмная",
};

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      className="btn btn--ghost btn--icon"
      onClick={() => {
        const next = THEME_NEXT[theme];
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={`${THEME_LABEL[theme]}. Переключить`}
      title={THEME_LABEL[theme]}
    >
      <Icon size={20} aria-hidden />
    </button>
  );
}

function Badge({ count, className }: { count: number; className: string }) {
  if (!count) return null;
  return (
    <span className={className} aria-hidden>
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, summary, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pending = summary?.pending_received ?? 0;
  const cabinetLabel = pending ? `Кабинет, ${pending} новых откликов` : "Кабинет";
  const isRoot = location.pathname === "/";

  useEffect(() => {
    initTelegram((scheme) => {
      if (readTheme() === "system") document.documentElement.dataset.theme = scheme;
    });
  }, []);

  // В Telegram системная кнопка «Назад» заменяет нашу: показываем её везде, кроме ленты.
  useEffect(() => bindTelegramBackButton(!isRoot, () => navigate(-1)), [isRoot, navigate]);

  return (
    <>
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>

      <header className="header">
        <div className="header__inner">
          <Link to="/" className="brand" aria-label="Команда — на главную">
            <span className="brand__mark">
              <Users size={18} aria-hidden />
            </span>
            <span>
              Команда<span className="brand__sub"> · Клуб</span>
            </span>
          </Link>

          <nav className="topnav" aria-label="Основная навигация">
            <NavLink to="/" end className="topnav__link">
              <LayoutGrid size={18} aria-hidden />
              Лента
            </NavLink>
            {user && (
              <NavLink to="/cabinet" className="topnav__link" aria-label={cabinetLabel}>
                <Inbox size={18} aria-hidden />
                Кабинет
                <Badge count={pending} className="nav-badge" />
              </NavLink>
            )}
            {user && (
              <NavLink to="/profile" className="topnav__link">
                <CircleUserRound size={18} aria-hidden />
                Профиль
              </NavLink>
            )}
          </nav>

          <div className="header__actions">
            <ThemeToggle />
            {user ? (
              <>
                <Link to="/new" className="btn btn--primary desktop-only">
                  <PlusCircle size={18} aria-hidden />
                  Разместить
                </Link>
                <button type="button" className="btn btn--ghost desktop-only" onClick={logout}>
                  Выйти
                </button>
              </>
            ) : (
              <Link
                to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
                className="btn btn--primary desktop-only"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      {children}

      <nav className="tabbar" aria-label="Основная навигация">
        <NavLink to="/" end className="tabbar__item">
          <LayoutGrid size={22} aria-hidden />
          Лента
        </NavLink>
        <NavLink to={user ? "/new" : "/login?next=%2Fnew"} className="tabbar__item tabbar__item--primary">
          <span className="tabbar__icon">
            <PlusCircle size={18} aria-hidden />
          </span>
          Разместить
        </NavLink>
        <NavLink to={user ? "/cabinet" : "/login?next=%2Fcabinet"} className="tabbar__item" aria-label={cabinetLabel}>
          <Inbox size={22} aria-hidden />
          Кабинет
          <Badge count={pending} className="tabbar__badge" />
        </NavLink>
        {user ? (
          <NavLink to="/profile" className="tabbar__item">
            <CircleUserRound size={22} aria-hidden />
            Профиль
          </NavLink>
        ) : (
          <NavLink to="/login" className="tabbar__item">
            <LogIn size={22} aria-hidden />
            Войти
          </NavLink>
        )}
      </nav>
    </>
  );
}
