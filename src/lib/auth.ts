import crypto from 'node:crypto'

export type UserRole = 'admin' | 'employee'

export type SessionPayload = {
  sub: string
  role: UserRole
  exp: number
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('Missing SESSION_SECRET')
  return secret
}

function base64Url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sign(payload: string) {
  return base64Url(crypto.createHmac('sha256', getSecret()).update(payload).digest())
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>) {
  const exp = Date.now() + SESSION_TTL_MS
  const body = base64Url(JSON.stringify({ ...payload, exp }))
  const sig = sign(body)
  return `${body}.${sig}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = sign(body)
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as SessionPayload
    if (!payload.exp || Date.now() > payload.exp) return null
    if (payload.role !== 'admin' && payload.role !== 'employee') return null
    if (!payload.sub) return null
    return payload
  } catch {
    return null
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  }
}
