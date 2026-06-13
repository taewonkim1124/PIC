import {
  createCheckin,
  findCheckin,
  findParticipantByCode,
} from "@/lib/notionStore";

type CheckinBody = {
  uniqueCode?: unknown;
  challengeId?: unknown;
  manager?: unknown;
};

function serverDate() {
  return new Date().toLocaleDateString("en-CA");
}

export async function POST(request: Request) {
  let body: CheckinBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const uniqueCode =
    typeof body.uniqueCode === "string" ? body.uniqueCode.trim() : "";
  const challengeId =
    typeof body.challengeId === "string" ? body.challengeId.trim() : "";
  const manager = typeof body.manager === "string" ? body.manager.trim() : "";

  if (!uniqueCode || !challengeId) {
    return Response.json(
      { error: "uniqueCode and challengeId are required." },
      { status: 400 },
    );
  }

  try {
    const participant = await findParticipantByCode(uniqueCode);
    if (!participant) {
      return Response.json({ error: "Participant not found." }, { status: 404 });
    }

    const checkinDate = serverDate();
    if (await findCheckin(participant.id, challengeId, checkinDate)) {
      return Response.json({
        status: "already_checked_in",
        participantName: participant.name,
        date: checkinDate,
        message: `${participant.name} is already checked in today.`,
      });
    }

    await createCheckin({
      participantId: participant.id,
      challenge: challengeId,
      date: checkinDate,
      manager,
    });

    return Response.json(
      {
        status: "checked_in",
        participantName: participant.name,
        date: checkinDate,
        message: `${participant.name} checked in successfully.`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Notion check-in failed:", error);
    return Response.json({ error: "Could not save check-in." }, { status: 500 });
  }
}
