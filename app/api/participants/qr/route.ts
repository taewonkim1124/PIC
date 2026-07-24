import {
  getParticipantById,
  getParticipants,
  updateParticipantCode,
} from "@/lib/notionStore";
import { createUniqueParticipantCode } from "@/lib/participantCodes";
import { sendQrEmail } from "@/lib/qrEmail";
import { requireRole } from "@/lib/auth";

type QrBody = {
  participantId?: unknown;
  reissue?: unknown;
  sendEmail?: unknown;
};

export async function POST(request: Request) {
  const unauthorized = await requireRole(["owner", "super_admin"]);
  if (unauthorized) return unauthorized;

  let body: QrBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const participantId =
    typeof body.participantId === "string" ? body.participantId.trim() : "";
  const shouldReissue = body.reissue === true;
  const shouldSendEmail = body.sendEmail === true;

  if (!participantId) {
    return Response.json({ error: "멤버 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const current = await getParticipantById(participantId);
    const needsNewCode = !current.unique_code || shouldReissue;
    const participant = needsNewCode
      ? await updateParticipantCode(
          participantId,
          await createUniqueParticipantCode(),
        )
      : current;

    if (shouldSendEmail) {
      await sendQrEmail(participant);
    }

    return Response.json({
      participant,
      emailSent: shouldSendEmail,
      reissued: Boolean(current.unique_code && shouldReissue),
    });
  } catch (error) {
    console.error("QR issuing failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "QR 코드를 발급할 수 없습니다.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireRole(["owner", "super_admin"]);
  if (unauthorized) return unauthorized;

  let body: { sendEmail?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const shouldSendEmail = body.sendEmail === true;

  try {
    const participants = await getParticipants();
    const updated = [];

    for (const participant of participants) {
      if (participant.unique_code) continue;

      const issued = await updateParticipantCode(
        participant.id,
        await createUniqueParticipantCode(),
      );

      if (shouldSendEmail && issued.email) {
        await sendQrEmail(issued);
      }

      updated.push(issued);
    }

    return Response.json({ participants: updated, count: updated.length });
  } catch (error) {
    console.error("Bulk QR issuing failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "미발급 멤버 QR 코드를 발급할 수 없습니다.",
      },
      { status: 500 },
    );
  }
}
