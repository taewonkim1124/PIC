import {
  createCheckin,
  findCheckin,
  findParticipantByCode,
} from "@/lib/notionStore";

type CheckinBody = {
  uniqueCode?: unknown;
  challengeId?: unknown;
};

function serverDate() {
  return new Date().toLocaleDateString("en-CA");
}

export async function POST(request: Request) {
  let body: CheckinBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const uniqueCode =
    typeof body.uniqueCode === "string" ? body.uniqueCode.trim() : "";
  const challengeId =
    typeof body.challengeId === "string" ? body.challengeId.trim() : "";

  if (!uniqueCode || !challengeId) {
    return Response.json(
      { error: "고유 QR 코드와 챌린지 이름이 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const participant = await findParticipantByCode(uniqueCode);
    if (!participant) {
      return Response.json({ error: "등록된 멤버를 찾을 수 없습니다." }, { status: 404 });
    }

    const checkinDate = serverDate();
    if (await findCheckin(participant.id, challengeId, checkinDate)) {
      return Response.json({
        status: "already_checked_in",
        participantName: participant.name,
        date: checkinDate,
        message: `${participant.name}님은 오늘 이미 참여했습니다.`,
      });
    }

    await createCheckin({
      participantId: participant.id,
      challenge: challengeId,
      date: checkinDate,
    });

    return Response.json(
      {
        status: "checked_in",
        participantName: participant.name,
        date: checkinDate,
        message: `${participant.name}님 체크인이 완료되었습니다.`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Notion check-in failed:", error);
    return Response.json({ error: "체크인을 저장할 수 없습니다." }, { status: 500 });
  }
}
