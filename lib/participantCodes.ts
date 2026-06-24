import { randomUUID } from "node:crypto";

import { findParticipantByCode } from "@/lib/notionStore";

export function createCandidateCode() {
  return `USER-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export async function createUniqueParticipantCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const uniqueCode = createCandidateCode();
    if (!(await findParticipantByCode(uniqueCode))) return uniqueCode;
  }

  throw new Error("고유 QR 코드를 생성할 수 없습니다.");
}
