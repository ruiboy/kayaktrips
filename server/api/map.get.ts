// Public. Everything the /maps page plots, in one request rather than two.
export default defineEventHandler(async (event) => {
  const handle = db(event)

  const [trips, campsites] = await Promise.all([
    all(
      handle.prepare(
        `select id, slug, title, start_place, end_place,
                start_lat, start_lon, end_lat, end_lon
           from trips order by start_date asc`,
      ),
    ),
    // Only sited campsites — the rest have nothing to plot.
    all(
      handle.prepare(
        `select id, trip_id, name, camped_on, lat, lon
           from campsites
          where lat is not null and lon is not null
          order by camped_on asc`,
      ),
    ),
  ])

  return { trips, campsites }
})
