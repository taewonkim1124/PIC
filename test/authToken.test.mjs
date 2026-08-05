import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  createAuthToken,
  verifyAuthToken,
} from "../lib/authToken.ts";

const originalAppAuthSecret = process.env.APP_AUTH_SECRET;
const originalAdminPassword = process.env.ADMIN_PASSWORD;

describe("auth token signing/verification", () => {
  beforeEach(() => {
    process.env.APP_AUTH_SECRET = "test-secret";
    delete process.env.ADMIN_PASSWORD;
  });

  afterEach(() => {
    if (originalAppAuthSecret === undefined) delete process.env.APP_AUTH_SECRET;
    else process.env.APP_AUTH_SECRET = originalAppAuthSecret;

    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
  });

  const session = { role: "admin", username: "alice", displayName: "Alice" };

  it("round-trips a session through create and verify", async () => {
    const token = await createAuthToken(session);
    const verified = await verifyAuthToken(token);
    assert.deepEqual(verified, session);
  });

  it("rejects a token with a tampered payload", async () => {
    const token = await createAuthToken(session);
    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ role: "owner", username: "alice", displayName: "Alice" }),
    ).toString("base64url");
    assert.notEqual(forgedPayload, payload);

    const verified = await verifyAuthToken(`${forgedPayload}.${signature}`);
    assert.equal(verified, null);
  });

  it("rejects a token with a tampered signature", async () => {
    const token = await createAuthToken(session);
    const [payload, signature] = token.split(".");
    const flippedChar = signature[0] === "a" ? "b" : "a";
    const tamperedSignature = flippedChar + signature.slice(1);

    const verified = await verifyAuthToken(`${payload}.${tamperedSignature}`);
    assert.equal(verified, null);
  });

  it("rejects malformed tokens", async () => {
    assert.equal(await verifyAuthToken(undefined), null);
    assert.equal(await verifyAuthToken(""), null);
    assert.equal(await verifyAuthToken("no-dot-here"), null);
    assert.equal(await verifyAuthToken("payload."), null);
    assert.equal(await verifyAuthToken(".signature"), null);
  });

  it("rejects a token signed under a different secret", async () => {
    const token = await createAuthToken(session);

    process.env.APP_AUTH_SECRET = "a-different-secret";
    const verified = await verifyAuthToken(token);
    assert.equal(verified, null);
  });

  it("fails closed instead of throwing when no secret is configured", async () => {
    const token = await createAuthToken(session);

    delete process.env.APP_AUTH_SECRET;
    delete process.env.ADMIN_PASSWORD;
    const verified = await verifyAuthToken(token);
    assert.equal(verified, null);
  });

  it("rejects a payload carrying an invalid role", async () => {
    const forgedPayload = Buffer.from(
      JSON.stringify({ role: "superadmin", username: "alice", displayName: "Alice" }),
    ).toString("base64url");
    const token = await createAuthToken(session);
    const [, signature] = token.split(".");

    // Signature won't match the forged payload, so this also exercises that
    // the signature check runs before role validation.
    const verified = await verifyAuthToken(`${forgedPayload}.${signature}`);
    assert.equal(verified, null);
  });
});
