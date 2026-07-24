import {
  createParticipant,
  findParticipantDuplicate,
  getParticipants,
} from "@/lib/notionStore";
import { createUniqueParticipantCode } from "@/lib/participantCodes";
import { publicParticipant } from "@/lib/participantViews";
import { sendQrEmail } from "@/lib/qrEmail";
import { requireRole } from "@/lib/auth";

type ParticipantBody = {
  name?: unknown;
  email?: unknown;
  sendEmail?: unknown;
};

export async function GET() {
  const unauthorized = await requireRole(["admin"]);
  if (unauthorized) return unauthorized;

  try {
    const participants = await getParticipants();
    return Response.json({ participants: participants.map(publicParticipant) });
  } catch (error) {
    console.error("Participant lookup failed:", error);
    return Response.json(
      { error: "멤버 목록을 불러올 수 없습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireRole(["admin"]);
  if (unauthorized) return unauthorized;

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
  const shouldSendEmail = body.sendEmail === true;

  if (!name) {
    return Response.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  try {
    const duplicate = await findParticipantDuplicate({ name, email });
    if (duplicate) {
      return Response.json(
        {
          error: "이미 등록된 멤버입니다.",
          participant: publicParticipant(duplicate),
        },
        { status: 409 },
      );
    }

    const uniqueCode = await createUniqueParticipantCode();
    const participant = await createParticipant({ name, email, uniqueCode });

    if (shouldSendEmail) {
      await sendQrEmail(participant);
    }

    return Response.json(
      { participant: publicParticipant(participant), emailSent: shouldSendEmail },
      { status: 201 },
    );
  } catch (error) {
    console.error("Participant creation failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "멤버를 등록할 수 없습니다.",
      },
      { status: 500 },
    );
  }
}
