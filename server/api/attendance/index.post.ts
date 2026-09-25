// "I was there". The trip comes from the request; the person never does — it
// is read from the verified token, which is what makes this a statement about
// yourself and not something one editor can say about another.
export default defineEventHandler(async (event) => {
  const person = await requirePerson(event)
  const body = (await readBody(event)) ?? {}
  const trip_id = String(body.trip_id ?? '')

  if (!trip_id) {
    throw createError({ statusCode: 400, statusMessage: 'A trip is required' })
  }

  // Checked rather than left to the foreign key: D1 reports a constraint failure
  // as a server error, and "there is no such trip" is a thing this route knows
  // how to say properly.
  const trip = await first<{ id: string }>(
    db(event).prepare('select id from trips where id = ?').bind(trip_id),
  )
  if (!trip) throw createError({ statusCode: 404, statusMessage: 'No such trip' })

  // `or ignore`, so clicking twice is the same as clicking once rather than a
  // primary key violation the client has to interpret.
  const written = await db(event)
    .prepare(
      `insert or ignore into attendances (trip_id, person_id, created_at)
       values (?, ?, ?)`,
    )
    .bind(trip_id, person.id, nowIso())
    .run()

  return { trip_id, initials: person.initials, created: written.meta?.changes === 1 }
})
