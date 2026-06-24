import { getParticipantById } from "@/lib/notionStore";
import { sendQrEmail } from "@/lib/qrEmail";

type EmailQrBody = {
  participantId?: unknown;
};

export async function POST(request: Request) {
  let body: EmailQrBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const participantId =
    typeof body.participantId === "string" ? body.participantId.trim() : "";

  if (!participantId) {
    return Response.json({ error: "멤버 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const participant = await getParticipantById(participantId);
    if (!participant.unique_code) {
      return Response.json(
        { error: "먼저 QR 코드를 발급해주세요." },
        { status: 400 },
      );
    }

    await sendQrEmail(participant);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("QR email failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "QR 이메일을 보낼 수 없습니다.",
      },
      { status: 500 },
    );
  }
}
