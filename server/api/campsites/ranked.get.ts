// Public. Every campsite on every trip, best first, for the /campsites page.
// The same columns as the per-trip list, since both render the same card, plus
// the trip each belongs to. `nulls last` so a site missing any rating sorts as
// unrated rather than as the worst; ties fall back to trip order, then night.
export default defineEventHandler(async (event) => {
  return all(
    db(event).prepare(
      `select c.id, c.name, c.camped_on, c.notes, c.lat, c.lon, c.bankage,
              c.campspots, c.firewood, c.shelter, c.aesthetics, c.score,
              t.slug as trip_slug, t.title as trip_title
         from campsites c
         join trips t on t.id = c.trip_id
        order by c.score desc nulls last, t.start_date asc, c.camped_on asc`,
    ),
  )
})
