import { randomBytes } from "node:crypto";

import { findParticipantByCode } from "@/lib/notionStore";

export function createCandidateCode() {
  return `PIC-${randomBytes(16).toString("hex").toUpperCase()}`;
}

export async function createUniqueParticipantCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const uniqueCode = createCandidateCode();
    if (!(await findParticipantByCode(uniqueCode))) return uniqueCode;
  }

  throw new Error("고유 QR 코드를 생성할 수 없습니다.");
}
