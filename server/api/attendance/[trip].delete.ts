// Opting back out. Again the person comes from the token, so this can only ever
// remove your own row.
export default defineEventHandler(async (event) => {
  const person = await requirePerson(event)

  const trip = getRouterParam(event, 'trip')
  if (!trip) throw createError({ statusCode: 400, statusMessage: 'No trip' })

  await db(event)
    .prepare('delete from attendances where trip_id = ? and person_id = ?')
    .bind(trip, person.id)
    .run()

  // No 404 for a row that wasn't there: "you are not on this trip" is the state
  // the caller asked for either way.
  return { trip_id: trip, initials: person.initials }
})
