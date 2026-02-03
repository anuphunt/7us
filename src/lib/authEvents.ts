import { supabaseServer } from '@/lib/supabaseServer'

export type AuthEventInput = {
  userIdShort?: string | null
  userId?: string | null
  ip: string
  userAgent: string
  eventType: string
  success: boolean
  reason?: string | null
  occurredAt?: Date
}

export async function logAuthEvent(input: AuthEventInput) {
  try {
    await supabaseServer.from('auth_events').insert({
      occurred_at: input.occurredAt ?? new Date(),
      user_id_short: input.userIdShort ?? null,
      user_id: input.userId ?? null,
      ip: input.ip,
      user_agent: input.userAgent,
      event_type: input.eventType,
      success: input.success,
      reason: input.reason ?? null,
    })
  } catch (error) {
    // Never block auth flows on audit logging.
    console.warn('Failed to log auth event', error)
  }
}

export async function countRecentFailedLoginsByIp(
  ip: string,
  since: Date
): Promise<number> {
  const { count, error } = await supabaseServer
    .from('auth_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'login')
    .eq('success', false)
    .eq('ip', ip)
    .gte('occurred_at', since.toISOString())

  if (error) {
    console.warn('Failed to count IP failures', error)
    return 0
  }

  return count ?? 0
}
