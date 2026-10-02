import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { normalizeDigits } from "./validation";

function getKeys() {
  const encryption = process.env.IDENTIFIER_ENCRYPTION_KEY ?? "";
  const lookup = process.env.IDENTIFIER_LOOKUP_KEY ?? "";
  const encryptionKey = Buffer.from(encryption, "base64");
  const lookupKey = Buffer.from(lookup, "base64");
  if (encryptionKey.length !== 32 || lookupKey.length !== 32 || encryptionKey.equals(lookupKey)) {
    throw new Error("Identifier protection requires two distinct 32-byte keys.");
  }
  return { encryptionKey, lookupKey };
}

export function encryptIdentifier(value: string, userId: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKeys().encryptionKey, nonce);
  cipher.setAAD(Buffer.from(`lub:university-id:${userId}`));
  const ciphertext = Buffer.concat([cipher.update(normalizeDigits(value), "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".");
}

// Only call from an authorized server operation which records sensitive access.
export function decryptIdentifier(envelope: string, userId: string) {
  const [version, nonce, tag, ciphertext, extra] = envelope.split(".");
  if (version !== "v1" || !nonce || !tag || !ciphertext || extra !== undefined) throw new Error("Invalid identifier envelope.");
  const decipher = createDecipheriv("aes-256-gcm", getKeys().encryptionKey, Buffer.from(nonce, "base64"));
  decipher.setAAD(Buffer.from(`lub:university-id:${userId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function identifierLookup(value: string) {
  return createHmac("sha256", getKeys().lookupKey).update(`lub:university-id:${normalizeDigits(value)}`).digest("hex");
}
