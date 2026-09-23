"use client";

import { useEffect } from "react";

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  colorScheme?: string;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** When Equis runs inside Telegram, take the full viewport and match the app's dark surface. */
export function TelegramMiniApp() {
  useEffect(() => {
    const app = window.Telegram?.WebApp;
    if (!app) return;
    app.ready();
    app.expand();
    app.setHeaderColor?.("#0A0B0D");
    app.setBackgroundColor?.("#0A0B0D");
    document.documentElement.dataset.telegram = "true";
  }, []);

  return null;
}
