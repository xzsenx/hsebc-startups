/* Тонкая обёртка над Telegram WebApp SDK. Вне Telegram все функции — no-op,
   приложение работает как обычный сайт. */

interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  ready: () => void;
  expand: () => void;
  onEvent: (event: string, cb: () => void) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred: (type: "success" | "error" | "warning") => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function webApp(): TelegramWebApp | null {
  const app = window.Telegram?.WebApp;
  // initData пустой, если страница открыта не из Telegram — тогда SDK не используем.
  return app && app.initData ? app : null;
}

export const isTelegram = () => webApp() !== null;

export function initTelegram(onTheme: (scheme: "light" | "dark") => void): void {
  const app = webApp();
  if (!app) return;
  app.ready();
  app.expand();
  app.onEvent("themeChanged", () => onTheme(app.colorScheme));
}

export const haptic = {
  tap: () => webApp()?.HapticFeedback?.impactOccurred("light"),
  success: () => webApp()?.HapticFeedback?.notificationOccurred("success"),
  error: () => webApp()?.HapticFeedback?.notificationOccurred("error"),
};

/** Системная кнопка «Назад» в шапке Telegram. Возвращает функцию отписки. */
export function bindTelegramBackButton(visible: boolean, onBack: () => void): () => void {
  const back = webApp()?.BackButton;
  if (!back) return () => undefined;
  if (visible) {
    back.show();
    back.onClick(onBack);
  } else {
    back.hide();
  }
  return () => back.offClick(onBack);
}
