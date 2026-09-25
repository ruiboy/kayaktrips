// The trips the caller has marked, as ids and nothing else.
//
// This is the authenticated half of the feature, and it exists so the public
// half never has to carry an email or a "this one is you" flag. The maps filter
// and the button's pressed state both read it.
export default defineEventHandler(async (event) => {
  const email = await editorEmail(event)
  const person = await personFor(event, email)
  // Not an error: a reader who isn't in the registry has no trips of their own,
  // which is an answer.
  if (!person) return { trip_ids: [] as string[] }

  const rows = await all<{ trip_id: string }>(
    db(event)
      .prepare('select trip_id from attendances where person_id = ?')
      .bind(person.id),
  )

  return { trip_ids: rows.map((row) => row.trip_id) }
})
