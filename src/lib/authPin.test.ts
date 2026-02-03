import { describe, expect, it } from 'vitest'
import {
  LOCK_DURATION_MS,
  LOCK_WINDOW_MS,
  MAX_FAILED_ATTEMPTS,
  getFailureStateAfterFailure,
  hashPin,
  isLocked,
  verifyPinWithLegacy,
} from '@/lib/authPin'

describe('authPin hashing', () => {
  it('hashes and verifies a valid pin', async () => {
    const hash = await hashPin('1234')
    await expect(verifyPinWithLegacy('1234', hash)).resolves.toEqual({ ok: true, legacy: false })
    await expect(verifyPinWithLegacy('9999', hash)).resolves.toEqual({ ok: false, legacy: false })
  })

  it('returns false for missing hashes', async () => {
    await expect(verifyPinWithLegacy('1234', null)).resolves.toEqual({ ok: false, legacy: false })
  })

  it('supports legacy plaintext pins (migration path)', async () => {
    await expect(verifyPinWithLegacy('1234', '1234')).resolves.toEqual({ ok: true, legacy: true })
    await expect(verifyPinWithLegacy('1234', '9999')).resolves.toEqual({ ok: false, legacy: false })
  })
})

describe('lockout logic', () => {
  it('locks after max failures within the window', () => {
    const now = new Date('2026-02-03T12:00:00.000Z')
    const state = getFailureStateAfterFailure({
      failedAttempts: MAX_FAILED_ATTEMPTS - 1,
      lastFailedAt: new Date(now.getTime() - 60 * 1000),
      now,
    })

    expect(state.failedAttempts).toBe(MAX_FAILED_ATTEMPTS)
    expect(state.lockedUntil?.toISOString()).toBe(
      new Date(now.getTime() + LOCK_DURATION_MS).toISOString()
    )
  })

  it('resets failures outside the window', () => {
    const now = new Date('2026-02-03T12:00:00.000Z')
    const state = getFailureStateAfterFailure({
      failedAttempts: 4,
      lastFailedAt: new Date(now.getTime() - LOCK_WINDOW_MS - 1000),
      now,
    })

    expect(state.failedAttempts).toBe(1)
    expect(state.lockedUntil).toBeNull()
  })

  it('detects active locks', () => {
    const now = new Date('2026-02-03T12:00:00.000Z')
    expect(isLocked(new Date(now.getTime() + 1000), now)).toBe(true)
    expect(isLocked(new Date(now.getTime() - 1000), now)).toBe(false)
  })
})
