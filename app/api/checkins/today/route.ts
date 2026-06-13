import { getCheckins } from "@/lib/notionStore";

function serverDate() {
  return new Date().toLocaleDateString("en-CA");
}

export async function GET(request: Request) {
  const challengeId = new URL(request.url).searchParams.get("challengeId") ?? "";

  if (!challengeId.trim()) {
    return Response.json(
      { error: "challengeId is required." },
      { status: 400 },
    );
  }

  const date = serverDate();
  try {
    const checkins = await getCheckins(challengeId.trim(), date);
    return Response.json({ date, checkins });
  } catch (error) {
    console.error("Today's Notion check-in lookup failed:", error);
    return Response.json(
      { error: "Could not load today's check-ins." },
      { status: 500 },
    );
  }
}
