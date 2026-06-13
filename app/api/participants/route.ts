import { randomUUID } from "node:crypto";

import { createParticipant, findParticipantByCode } from "@/lib/notionStore";

type ParticipantBody = {
  name?: unknown;
  email?: unknown;
};

export async function POST(request: Request) {
  let body: ParticipantBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : null;

  if (!name) {
    return Response.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const uniqueCode = `USER-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    try {
      if (await findParticipantByCode(uniqueCode)) continue;
      const participant = await createParticipant({ name, email, uniqueCode });
      return Response.json({ participant }, { status: 201 });
    } catch (error) {
      console.error("Participant creation failed:", error);
      return Response.json({ error: "멤버를 등록할 수 없습니다." }, { status: 500 });
    }
  }

  return Response.json(
    { error: "고유 QR 코드를 생성할 수 없습니다." },
    { status: 500 },
  );
}
