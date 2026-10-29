import { randomBytes } from 'node:crypto';

export const PROFILE_HEADER = 'x-profile-id';
export const PROFILE_CODE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function normalizeProfileCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '');
}

export function isValidProfileCode(value: string): boolean {
  return PROFILE_CODE_PATTERN.test(value);
}

export function generateProfileCode(): string {
  const raw = randomBytes(12).toString('base64url');
  return raw.match(/.{1,4}/g)?.join('-') ?? raw;
}
