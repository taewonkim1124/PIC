import Link from "next/link";
import type { CSSProperties } from "react";

const menu = [
  {
    href: "/join",
    title: "가입 신청",
    description: "멤버가 직접 정보를 제출하고 이메일로 개인 QR 코드를 받습니다.",
    color: "#7c3aed",
  },
  {
    href: "/scan",
    title: "QR 체크인",
    description: "관리자가 멤버의 고유 QR을 스캔해서 챌린지 참여를 기록합니다.",
    color: "#172554",
  },
  {
    href: "/admin/participants",
    title: "멤버 관리",
    description: "멤버를 등록하고, 기존 멤버 QR을 발급하거나 다시 보냅니다.",
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
];

export default function Home() {
  return (
    <main style={styles.main}>
      <header>
        <p style={styles.eyebrow}>PIC 동아리</p>
        <h1 style={styles.heading}>QR 체크인</h1>
        <p style={styles.subtitle}>
          가입 신청부터 QR 발급, 챌린지 참여 확인까지 관리합니다.
        </p>
      </header>

      <section style={styles.menu}>
        {menu.map((item) => (
          <Link key={item.href} href={item.href} style={styles.link}>
            <article style={{ ...styles.card, borderLeftColor: item.color }}>
              <h2 style={styles.cardTitle}>{item.title}</h2>
              <p style={styles.description}>{item.description}</p>
            </article>
          </Link>
        ))}
      </section>

      <p style={styles.install}>
        가입 양식은 <strong>/join</strong> 주소를 공유하면 됩니다. iPhone에서는
        Safari 공유 메뉴에서 홈 화면에 추가할 수 있습니다.
      </p>
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
};
