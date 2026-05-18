import crypto from "crypto";

const KEY_SOURCE = process.env.SESSION_SECRET || "chronomax-kits-super-secret-password-change-in-production-32chars";
const key = crypto.createHash("sha256").update(KEY_SOURCE).digest();

export function criptografar(texto: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function descriptografar(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
