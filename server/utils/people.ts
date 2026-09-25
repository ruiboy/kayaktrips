import type { H3Event } from 'h3'

/**
 * The person behind the request, or a 403.
 *
 * Access says who may write; this says who they are on the page. They are not
 * the same question, and the registry is deliberately not filled in from the
 * token: initials are assigned by hand, so an editor who has been added to the
 * Access policy but not to `people` can sign in, upload and edit, and simply
 * has no attendance to give. The UI hides the control in that case — this is
 * what answers if a request arrives anyway.
 */
export async function requirePerson(
  event: H3Event,
): Promise<{ id: string; initials: string }> {
  const email = await requireEditor(event)
  const person = await personFor(event, email)

  if (!person) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You are not in the crew registry yet',
    })
  }
  return person
}

/** The registry row for an email, or null. Never throws: /api/me asks this. */
export async function personFor(event: H3Event, email: string | null) {
  if (!email) return null
  return (
    (await first<{ id: string; initials: string }>(
      db(event).prepare('select id, initials from people where email = ?').bind(email),
    )) ?? null
  )
}
