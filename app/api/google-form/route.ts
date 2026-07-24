import {
  createParticipant,
  findParticipantDuplicate,
  updateParticipantRegistration,
} from "@/lib/notionStore";
import { createUniqueParticipantCode } from "@/lib/participantCodes";
import { publicParticipant } from "@/lib/participantViews";
import { sendQrEmail } from "@/lib/qrEmail";

type GoogleFormBody = {
  secret?: unknown;
  name?: unknown;
  role?: unknown;
  team?: unknown;
  memo?: unknown;
  gender?: unknown;
  email?: unknown;
  kakao?: unknown;
  phone?: unknown;
  instagram?: unknown;
  joinDate?: unknown;
  grade?: unknown;
  sendEmail?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function authorized(request: Request, body: GoogleFormBody) {
  const expected = process.env.GOOGLE_FORM_SECRET;
  if (!expected) return true;

  const headerSecret = request.headers.get("x-google-form-secret");
  return headerSecret === expected || body.secret === expected;
}

async function trySendQrEmail(participant: {
  name: string;
  email: string | null;
  unique_code: string;
}) {
  try {
    await sendQrEmail(participant);
    return { emailSent: true, emailError: null };
  } catch (error) {
    console.error("Google Form QR email failed:", error);
    return {
      emailSent: false,
      emailError:
        error instanceof Error ? error.message : "QR 이메일 발송에 실패했습니다.",
    };
  }
}

export async function POST(request: Request) {
  let body: GoogleFormBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!authorized(request, body)) {
    return Response.json({ error: "인증에 실패했습니다." }, { status: 401 });
  }

  const name = text(body.name);
  const email = text(body.email);

  if (!name) {
    return Response.json({ error: "이름이 필요합니다." }, { status: 400 });
  }

  if (email && !isEmail(email)) {
    return Response.json(
      { error: "이메일 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const registration = {
    name,
    email,
    role: text(body.role),
    team: text(body.team),
    memo: text(body.memo),
    gender: text(body.gender),
    kakao: text(body.kakao),
    phone: text(body.phone),
    instagram: text(body.instagram),
    joinDate: text(body.joinDate),
    grade: text(body.grade),
    active: true,
  };
  const shouldSendEmail = body.sendEmail !== false;

  try {
    const duplicate = await findParticipantDuplicate({ name, email });

    if (duplicate) {
      const uniqueCode =
        duplicate.unique_code || (await createUniqueParticipantCode());
      const participant = await updateParticipantRegistration(duplicate.id, {
        ...registration,
        uniqueCode,
      });
      const emailResult =
        shouldSendEmail && participant.email
          ? await trySendQrEmail(participant)
          : { emailSent: false, emailError: null };

      return Response.json({
        status: "updated_existing_member",
        participant: publicParticipant(participant),
        ...emailResult,
      });
    }

    const participant = await createParticipant({
      ...registration,
      uniqueCode: await createUniqueParticipantCode(),
    });
    const emailResult =
      shouldSendEmail && participant.email
        ? await trySendQrEmail(participant)
        : { emailSent: false, emailError: null };

    return Response.json(
      {
        status: "created_member",
        participant: publicParticipant(participant),
        ...emailResult,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Google Form member sync failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Google Form 응답을 멤버 DB에 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
