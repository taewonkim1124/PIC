import { getChallengeNames } from "@/lib/notionStore";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireRole(["admin"]);
  if (unauthorized) return unauthorized;

  try {
    const challenges = await getChallengeNames();
    return Response.json({ challenges });
  } catch (error) {
    console.error("Notion challenge lookup failed:", error);
    return Response.json(
      { error: "챌린지 목록을 불러올 수 없습니다." },
      { status: 500 },
    );
  }
}
