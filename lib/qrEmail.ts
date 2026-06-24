import "server-only";

import QRCode from "qrcode";
import { Resend } from "resend";

type Participant = {
  name: string;
  email: string | null;
  unique_code: string;
};

export async function createQrDataUrl(uniqueCode: string) {
  return QRCode.toDataURL(uniqueCode, {
    width: 640,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

export async function sendQrEmail(participant: Participant) {
  if (!participant.email) {
    throw new Error("이메일 주소가 없는 멤버입니다.");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.QR_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("이메일 발송 환경변수가 설정되지 않았습니다.");
  }

  const qrDataUrl = await createQrDataUrl(participant.unique_code);
  const qrBase64 = qrDataUrl.split(",")[1];

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [participant.email],
    subject: "[PIC] 멤버 QR 코드",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h1>PIC 멤버 QR 코드</h1>
        <p>${participant.name}님, 아래 첨부파일의 QR 코드를 체크인할 때 사용해주세요.</p>
        <p><strong>고유코드:</strong> ${participant.unique_code}</p>
      </div>
    `,
    attachments: [
      {
        filename: `${participant.name}-pic-qr.png`,
        content: qrBase64,
      },
    ],
  });

  if (error) {
    throw new Error(error.message);
  }
}
