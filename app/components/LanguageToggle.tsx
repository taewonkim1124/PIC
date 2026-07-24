"use client";

import type { CSSProperties } from "react";

import { useLanguage } from "@/app/useLanguage";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      style={styles.button}
      aria-label="Toggle language"
    >
      {language === "ko" ? "EN" : "한"}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  button: {
    position: "fixed",
    top: 14,
    right: 14,
    zIndex: 50,
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "9px 12px",
    background: "#ffffff",
    color: "#172033",
    fontSize: 13,
    fontWeight: 800,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
    cursor: "pointer",
  },
};
