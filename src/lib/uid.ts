import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 8) {
  const bytes = randomBytes(length);
  let out = "";

  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return out;
}

export function createCustomerUid() {
  return `CUS_${randomCode(8)}`;
}

export function createProductUid() {
  return `PRD_${randomCode(8)}`;
}
