import { createPayment, findParticipantByCode } from "@/lib/notionStore";
import { requireRole } from "@/lib/auth";

type PaymentBody = {
  uniqueCode?: unknown;
  amount?: unknown;
  item?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function amountNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replaceAll(",", ""));
  return Number.NaN;
}

export async function POST(request: Request) {
  const unauthorized = await requireRole(["admin", "payment"]);
  if (unauthorized) return unauthorized;

  let body: PaymentBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const uniqueCode = text(body.uniqueCode);
  const item = text(body.item);
  const amount = amountNumber(body.amount);

  if (!uniqueCode) {
    return Response.json({ error: "QR 코드가 필요합니다." }, { status: 400 });
  }

  if (!item) {
    return Response.json({ error: "아이템을 입력해주세요." }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "가격을 올바르게 입력해주세요." }, { status: 400 });
  }

  try {
    const participant = await findParticipantByCode(uniqueCode);
    if (!participant) {
      return Response.json(
        { error: "등록된 멤버를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    await createPayment({
      participantId: participant.id,
      participantName: participant.name,
      uniqueCode,
      amount,
      item,
    });

    return Response.json(
      {
        status: "paid",
        participantName: participant.name,
        uniqueCode,
        amount,
        item,
        message: `${participant.name}님의 결제 기록이 저장되었습니다.`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Notion payment creation failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "결제 기록을 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
