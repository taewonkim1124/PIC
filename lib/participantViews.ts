type ParticipantWithCode = {
  unique_code?: string | null;
};

export function maskUniqueCode(uniqueCode: string | null | undefined) {
  if (!uniqueCode) return "";
  if (uniqueCode.length <= 12) return `${uniqueCode.slice(0, 4)}...`;
  return `${uniqueCode.slice(0, 8)}...${uniqueCode.slice(-4)}`;
}

export function publicParticipant<T extends ParticipantWithCode>(participant: T) {
  const safeParticipant = { ...participant };
  delete safeParticipant.unique_code;

  return {
    ...safeParticipant,
    has_qr: Boolean(participant.unique_code),
    masked_code: maskUniqueCode(participant.unique_code),
  };
}
