"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Language = "ko" | "en";

const storageKey = "pic-language";
const eventName = "pic-language-change";

function isLanguage(value: string | null): value is Language {
  return value === "ko" || value === "en";
}

function getLanguageSnapshot(): Language {
  if (typeof window === "undefined") return "ko";

  const savedLanguage = window.localStorage.getItem(storageKey);
  return isLanguage(savedLanguage) ? savedLanguage : "ko";
}

function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useLanguage() {
  const language = useSyncExternalStore<Language>(
    subscribe,
    getLanguageSnapshot,
    () => "ko",
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function setLanguage(nextLanguage: Language) {
    window.localStorage.setItem(storageKey, nextLanguage);
    window.dispatchEvent(new Event(eventName));
  }

  function toggleLanguage() {
    setLanguage(language === "ko" ? "en" : "ko");
  }

  return { language, setLanguage, toggleLanguage };
}

export function pick<T extends { ko: unknown; en: unknown }>(
  language: Language,
  labels: T,
): T["ko"] | T["en"] {
  return labels[language];
}
