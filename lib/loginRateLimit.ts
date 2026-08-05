// In-memory login throttle, keyed per (IP, username) pair. This only
// protects a single warm server instance - it resets on redeploy/restart and
// doesn't share state across horizontally scaled instances - but it stops
// naive password-guessing scripts, which is the realistic threat for this
// app's login surface.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type Attempt = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

const attempts = new Map<string, Attempt>();

function pruneExpired(now: number) {
  for (const [key, attempt] of attempts) {
    const expired =
      attempt.lockedUntil <= now && now - attempt.firstAttemptAt > WINDOW_MS;
    if (expired) attempts.delete(key);
  }
}

export function loginRateLimitKey(request: Request, username: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${username.trim().toLowerCase()}`;
}

export function isLoginRateLimited(key: string) {
  const attempt = attempts.get(key);
  return Boolean(attempt && attempt.lockedUntil > Date.now());
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  pruneExpired(now);

  const attempt = attempts.get(key);
  if (!attempt || now - attempt.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now, lockedUntil: 0 });
    return;
  }

  attempt.count += 1;
  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_MS;
  }
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
