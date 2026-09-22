// Public. Column list mirrors the Link type in app/components/TripLinks.vue.
export default defineEventHandler(async (event) => {
  const { trip } = getQuery(event)
  if (typeof trip !== 'string' || !trip) {
    throw createError({ statusCode: 400, statusMessage: 'trip is required' })
  }

  return all(
    db(event)
      .prepare(
        `select id, url, label, created_at
           from links where trip_id = ? order by created_at asc`,
      )
      .bind(trip),
  )
})
