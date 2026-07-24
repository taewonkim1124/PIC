"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import { pick, useLanguage } from "@/app/useLanguage";

const copy = {
  ko: {
    eyebrow: "PIC 동아리",
    heading: "QR 체크인",
    subtitle: "QR 발급, 챌린지 참여 확인, 결제 장부까지 관리합니다.",
    install:
      "iPhone이나 iPad에서는 Safari 공유 메뉴에서 홈 화면에 추가해서 앱처럼 사용할 수 있습니다.",
    logout: "로그아웃",
    menu: [
      {
        href: "/scan",
        title: "QR 체크인",
        description:
          "관리자가 멤버의 고유 QR을 스캔해서 챌린지 참여를 기록합니다.",
        color: "#172554",
      },
      {
        href: "/admin/participants",
        title: "멤버 관리",
        description:
          "기존 멤버 QR 조회, 발급, 재발급, 이메일 발송을 관리합니다.",
        color: "#0369a1",
      },
      {
        href: "/checkins",
        title: "참여명단",
        description: "오늘 챌린지에 참여한 멤버를 확인합니다.",
        color: "#047857",
      },
      {
        href: "/payment",
        title: "결제 장부",
        description: "멤버 QR을 스캔해서 결제 기록을 Notion 장부에 저장합니다.",
        color: "#c2410c",
      },
    ],
  },
  en: {
    eyebrow: "PIC Club",
    heading: "QR Check-in",
    subtitle: "Manage QR issuing, challenge check-ins, and payment records.",
    install:
      "On iPhone or iPad, add this site to the Home Screen from Safari to use it like an app.",
    logout: "Log Out",
    menu: [
      {
        href: "/scan",
        title: "QR Check-in",
        description:
          "Scan a member's unique QR code to record challenge participation.",
        color: "#172554",
      },
      {
        href: "/admin/participants",
        title: "Member Management",
        description:
          "View, issue, reissue, and email QR codes for existing members.",
        color: "#0369a1",
      },
      {
        href: "/checkins",
        title: "Participant List",
        description: "View members who checked in for today's challenge.",
        color: "#047857",
      },
      {
        href: "/payment",
        title: "Payment Ledger",
        description:
          "Scan member QR codes and save payment records to the Notion ledger.",
        color: "#c2410c",
      },
    ],
  },
} as const;

export default function Home() {
  const { language } = useLanguage();
  const t = pick(language, copy);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main style={styles.main}>
      <header>
        <p style={styles.eyebrow}>{t.eyebrow}</p>
        <h1 style={styles.heading}>{t.heading}</h1>
        <p style={styles.subtitle}>{t.subtitle}</p>
      </header>

      <section style={styles.menu}>
        {t.menu.map((item) => (
          <Link key={item.href} href={item.href} style={styles.link}>
            <article style={{ ...styles.card, borderLeftColor: item.color }}>
              <h2 style={styles.cardTitle}>{item.title}</h2>
              <p style={styles.description}>{item.description}</p>
            </article>
          </Link>
        ))}
      </section>

      <p style={styles.install}>{t.install}</p>
      <button onClick={logout} style={styles.logoutButton}>
        {t.logout}
      </button>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    minHeight: "100vh",
    maxWidth: 720,
    margin: "0 auto",
    padding: "56px 20px 32px",
    background: "#f4f7fb",
    color: "#172033",
  },
  eyebrow: {
    margin: 0,
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 2,
  },
  heading: { margin: "8px 0", fontSize: 40, lineHeight: 1.1 },
  subtitle: { margin: 0, color: "#64748b", fontSize: 17, lineHeight: 1.5 },
  menu: { display: "grid", gap: 14, marginTop: 40 },
  link: { color: "inherit", textDecoration: "none" },
  card: {
    padding: 22,
    border: "1px solid #dbe4ef",
    borderLeft: "6px solid",
    borderRadius: 14,
    background: "#ffffff",
    boxShadow: "0 6px 22px rgba(15, 23, 42, 0.06)",
  },
  cardTitle: { margin: "0 0 8px", fontSize: 21 },
  description: { margin: 0, color: "#64748b", lineHeight: 1.5 },
  install: {
    marginTop: 28,
    padding: 14,
    borderRadius: 10,
    background: "#e0f2fe",
    color: "#075985",
    fontSize: 14,
    lineHeight: 1.5,
  },
  logoutButton: {
    display: "inline-block",
    marginTop: 14,
    border: 0,
    background: "transparent",
    color: "#0369a1",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
    padding: 0,
  },
};
