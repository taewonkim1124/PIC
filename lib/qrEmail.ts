import "server-only";

import nodemailer from "nodemailer";
import QRCode from "qrcode";

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

function emailHtml(participant: Participant) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h1>PIC Member QR Code</h1>
      <p>Hello ${participant.name}, please use the attached QR code when checking in.</p>
      <p><strong>Unique Code:</strong> ${participant.unique_code}</p>
    </div>
  `;
}

async function sendWithGmail(participant: Participant, qrBase64: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.",
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"PIC" <${user}>`,
    to: participant.email ?? undefined,
    subject: "[PIC] Member QR Code",
    html: emailHtml(participant),
    attachments: [
      {
        filename: `${participant.name}-pic-qr.png`,
        content: Buffer.from(qrBase64, "base64"),
        contentType: "image/png",
      },
    ],
  });

}

export async function sendQrEmail(participant: Participant) {
  if (!participant.email) {
    throw new Error("This member does not have an email address.");
  }

  const qrDataUrl = await createQrDataUrl(participant.unique_code);
  const qrBase64 = qrDataUrl.split(",")[1];

  await sendWithGmail(participant, qrBase64);
}
