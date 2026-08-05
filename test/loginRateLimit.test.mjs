import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  clearLoginFailures,
  isLoginRateLimited,
  loginRateLimitKey,
  recordLoginFailure,
} from "../lib/loginRateLimit.ts";

function uniqueUsername() {
  return `user-${randomUUID()}`;
}

describe("login rate limiting", () => {
  it("builds a key from the client IP and normalized username", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    assert.equal(loginRateLimitKey(request, "  Alice  "), "203.0.113.5:alice");
  });

  it("falls back to 'unknown' when there is no forwarded-for header", () => {
    const request = new Request("https://example.com");
    assert.equal(loginRateLimitKey(request, "bob"), "unknown:bob");
  });

  it("does not rate limit before the failure threshold is reached", () => {
    const key = uniqueUsername();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      recordLoginFailure(key);
    }
    assert.equal(isLoginRateLimited(key), false);
  });

  it("locks the key out after 5 consecutive failures", () => {
    const key = uniqueUsername();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordLoginFailure(key);
    }
    assert.equal(isLoginRateLimited(key), true);
  });

  it("clears failures on success, un-blocking the key", () => {
    const key = uniqueUsername();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordLoginFailure(key);
    }
    assert.equal(isLoginRateLimited(key), true);

    clearLoginFailures(key);
    assert.equal(isLoginRateLimited(key), false);
  });

  it("tracks separate keys independently", () => {
    const keyA = uniqueUsername();
    const keyB = uniqueUsername();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordLoginFailure(keyA);
    }

    assert.equal(isLoginRateLimited(keyA), true);
    assert.equal(isLoginRateLimited(keyB), false);
  });
});
