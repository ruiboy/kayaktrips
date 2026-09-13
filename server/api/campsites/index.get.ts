// Public. Column list mirrors CAMPSITE_COLUMNS in app/composables/useCampsites.ts.
export default defineEventHandler(async (event) => {
  const { trip } = getQuery(event)
  if (typeof trip !== 'string' || !trip) {
    throw createError({ statusCode: 400, statusMessage: 'trip is required' })
  }

  return all(
    db(event)
      .prepare(
        `select id, name, camped_on, notes, lat, lon, bankage, campspots,
                firewood, shelter, aesthetics, score
           from campsites where trip_id = ? order by camped_on asc`,
      )
      .bind(trip),
  )
})
