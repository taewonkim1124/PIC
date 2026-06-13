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
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : null;

  if (!name) {
    return Response.json({ error: "Name is required." }, { status: 400 });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const uniqueCode = `USER-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    try {
      if (await findParticipantByCode(uniqueCode)) continue;
      const participant = await createParticipant({ name, email, uniqueCode });
      return Response.json({ participant }, { status: 201 });
    } catch (error) {
      console.error("Participant creation failed:", error);
      return Response.json({ error: "Could not create participant." }, { status: 500 });
    }
  }

  return Response.json(
    { error: "Could not generate a unique participant code." },
    { status: 500 },
  );
}
