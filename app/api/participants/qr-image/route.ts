import { createQrDataUrl } from "@/lib/qrEmail";
import { requireRole } from "@/lib/auth";
import { getParticipantById } from "@/lib/notionStore";

export async function GET(request: Request) {
  const unauthorized = await requireRole(["admin"]);
  if (unauthorized) return unauthorized;

  const participantId =
    new URL(request.url).searchParams.get("participantId")?.trim() ?? "";

  if (!participantId) {
    return Response.json({ error: "Participant ID is required." }, { status: 400 });
  }

  try {
    const participant = await getParticipantById(participantId);
    if (!participant.unique_code) {
      return Response.json({ error: "QR code has not been issued." }, { status: 404 });
    }

    return Response.json({
      qrImage: await createQrDataUrl(participant.unique_code),
    });
  } catch (error) {
    console.error("QR image generation failed:", error);
    return Response.json(
      { error: "Could not generate QR image." },
      { status: 500 },
    );
  }
}
