import {
  createParticipant,
  findParticipantDuplicate,
  updateParticipantRegistration,
} from "@/lib/notionStore";
import { createUniqueParticipantCode } from "@/lib/participantCodes";
import { sendQrEmail } from "@/lib/qrEmail";

type JoinBody = {
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
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    console.error("Join QR email failed:", error);
    return {
      emailSent: false,
      emailError: error instanceof Error ? error.message : "이메일 발송에 실패했습니다.",
    };
  }
}

export async function POST(request: Request) {
  let body: JoinBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = text(body.name);
  const email = text(body.email);

  if (!name) {
    return Response.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  if (!email || !isEmail(email)) {
    return Response.json(
      { error: "QR 코드를 받을 수 있는 이메일을 입력해주세요." },
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

  try {
    const duplicate = await findParticipantDuplicate({ name, email });

    if (duplicate) {
      const uniqueCode =
        duplicate.unique_code || (await createUniqueParticipantCode());
      const participant = await updateParticipantRegistration(duplicate.id, {
        ...registration,
        uniqueCode,
      });
      const emailResult = await trySendQrEmail(participant);

      return Response.json({
        status: "already_registered",
        participant,
        ...emailResult,
      });
    }

    const participant = await createParticipant({
      ...registration,
      uniqueCode: await createUniqueParticipantCode(),
    });
    const emailResult = await trySendQrEmail(participant);

    return Response.json(
      {
        status: "registered",
        participant,
        ...emailResult,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Join registration failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "가입 신청을 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
