import { getCheckins } from "@/lib/notionStore";
import { requireRole } from "@/lib/auth";
import { newYorkDate } from "@/lib/dates";

export async function GET(request: Request) {
  const unauthorized = await requireRole(["admin"]);
  if (unauthorized) return unauthorized;

  const challengeId = new URL(request.url).searchParams.get("challengeId") ?? "";

  if (!challengeId.trim()) {
    return Response.json(
      { error: "챌린지 이름을 입력해주세요." },
      { status: 400 },
    );
  }

  const date = newYorkDate();
  try {
    const checkins = await getCheckins(challengeId.trim(), date);
    return Response.json({ date, checkins });
  } catch (error) {
    console.error("Today's Notion check-in lookup failed:", error);
    return Response.json(
      { error: "오늘의 참여명단을 불러올 수 없습니다." },
      { status: 500 },
    );
  }
}
