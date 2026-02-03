import crypto from 'node:crypto'
import argon2 from 'argon2'

export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_WINDOW_MS = 1000 * 60 * 15
export const LOCK_DURATION_MS = 1000 * 60 * 15

// Used to equalize timing when a user does not exist.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG'

export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, { type: argon2.argon2id })
}

export type VerifyResult =
  | { ok: true; legacy: false }
  | { ok: true; legacy: true }
  | { ok: false; legacy: false }

function isArgonHash(hash: string) {
  return hash.startsWith('$argon2')
}

function timingSafeEqualStrings(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

/**
 * Verify a PIN against the stored hash.
 *
 * Compatibility: if the stored value is NOT an argon2 hash, we treat it as a legacy plaintext
 * value and compare timing-safely. This allows seamless migration: on success, the caller
 * should re-hash and overwrite `pin_hash`.
 */
export async function verifyPinWithLegacy(
  pin: string,
  stored: string | null | undefined
): Promise<VerifyResult> {
  // No stored value: do dummy argon2 to equalize timing, but always fail.
  if (!stored) {
    try {
      await argon2.verify(DUMMY_HASH, pin)
    } catch {
      // ignore
    }
    return { ok: false, legacy: false }
  }

  if (!isArgonHash(stored)) {
    return timingSafeEqualStrings(stored, pin)
      ? { ok: true, legacy: true }
      : { ok: false, legacy: false }
  }

  try {
    const matched = await argon2.verify(stored, pin)
    return matched ? { ok: true, legacy: false } : { ok: false, legacy: false }
  } catch {
    return { ok: false, legacy: false }
  }
}

export type FailureState = {
  failedAttempts: number
  lastFailedAt: Date
  lockedUntil: Date | null
}

export function getFailureStateAfterFailure(input: {
  failedAttempts: number | null | undefined
  lastFailedAt: Date | string | null | undefined
  now?: Date
}): FailureState {
  const now = input.now ?? new Date()
  const lastFailed =
    typeof input.lastFailedAt === 'string'
      ? new Date(input.lastFailedAt)
      : input.lastFailedAt ?? null
  const lastFailedValid =
    lastFailed && !Number.isNaN(lastFailed.getTime()) ? lastFailed : null

  let attempts = input.failedAttempts ?? 0
  if (!lastFailedValid || now.getTime() - lastFailedValid.getTime() > LOCK_WINDOW_MS) {
    attempts = 0
  }

  attempts += 1
  const lockedUntil =
    attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_DURATION_MS) : null

  return {
    failedAttempts: attempts,
    lastFailedAt: now,
    lockedUntil,
  }
}

export function isLocked(
  lockedUntil: Date | string | null | undefined,
  now = new Date()
): boolean {
  if (!lockedUntil) return false
  const value = typeof lockedUntil === 'string' ? new Date(lockedUntil) : lockedUntil
  if (Number.isNaN(value.getTime())) return false
  return value.getTime() > now.getTime()
}
