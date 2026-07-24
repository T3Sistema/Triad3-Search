import { createHash } from "node:crypto";

/** Used to key rate-limit rows without ever storing the raw e-mail/IP. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
