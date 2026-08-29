/** Id helpers. Kept tiny so the rest of the code never touches crypto directly. */

export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Human-friendly join code, ambiguous characters (0/O/1/I) removed. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function genCode(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
