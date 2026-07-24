import { createHmac } from "node:crypto";
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) continue;

  let value = match[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[match[1]] = value;
}

const password = process.argv[2];
const secret = process.env.APP_AUTH_SECRET || process.env.ADMIN_PASSWORD;

if (!password) {
  console.error("Usage: node scripts/hash-admin-password.mjs <password>");
  process.exit(1);
}

if (!secret) {
  console.error("APP_AUTH_SECRET or ADMIN_PASSWORD is required in .env.local.");
  process.exit(1);
}

console.log(createHmac("sha256", secret).update(password).digest("hex"));
