import { changeAdminPassword } from "@/lib/adminStore";
import { currentSession, requireRole } from "@/lib/auth";

type PasswordBody = {
  currentPassword?: unknown;
  nextPassword?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function POST(request: Request) {
  const unauthorized = await requireRole(["admin"]);
  if (unauthorized) return unauthorized;

  const session = await currentSession();
  if (!session || session.role !== "admin") {
    return Response.json(
      { error: "Only Notion admin accounts can change password here." },
      { status: 403 },
    );
  }

  let body: PasswordBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const currentPassword = text(body.currentPassword);
  const nextPassword = text(body.nextPassword);

  if (!currentPassword || nextPassword.length < 8) {
    return Response.json(
      { error: "Current password and a new password of at least 8 characters are required." },
      { status: 400 },
    );
  }

  try {
    await changeAdminPassword({
      username: session.username,
      currentPassword,
      nextPassword,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Admin password change failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not change password.",
      },
      { status: 500 },
    );
  }
}
