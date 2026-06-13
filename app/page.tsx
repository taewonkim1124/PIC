import Link from "next/link";

const menu = [
  {
    href: "/scan",
    title: "QR 체크인",
    description: "관리자가 멤버의 고유 QR을 스캔합니다.",
    color: "#172554",
  },
  {
    href: "/admin/participants",
    title: "멤버 등록",
    description: "새 멤버를 등록하고 고유 QR을 발급합니다.",
    color: "#0369a1",
  },
  {
    href: "/checkins",
    title: "참여명단",
    description: "오늘 챌린지에 참여한 멤버를 확인합니다.",
    color: "#047857",
  },
];

export default function Home() {
  return (
    <main style={styles.main}>
      <header>
        <p style={styles.eyebrow}>PIC CLUB</p>
        <h1 style={styles.heading}>QR Check-in</h1>
        <p style={styles.subtitle}>멤버 등록부터 챌린지 참여 확인까지</p>
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
        휴대폰 브라우저 메뉴에서 홈 화면에 추가하면 앱처럼 사용할 수 있습니다.
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    maxWidth: 680,
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
  subtitle: { margin: 0, color: "#64748b", fontSize: 17 },
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
