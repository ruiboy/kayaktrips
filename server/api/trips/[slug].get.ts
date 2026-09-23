// Public. One round trip for the trip, one for its photos — D1 has no
// equivalent of an embed, and two statements beat assembling a join by hand.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'No slug' })

  const trip = await first<Record<string, unknown>>(
    db(event)
      .prepare(
        `select id, slug, title, start_date, end_date, start_place, end_place,
                notes, badge_photo_id, start_lat, start_lon, end_lat, end_lon
           from trips where slug = ?`,
      )
      .bind(slug),
  )
  if (!trip) throw createError({ statusCode: 404, statusMessage: 'No such trip' })

  // Filed photos only, as before — anything with a null trip_id stays in the
  // general gallery.
  const photos = await all(
    db(event)
      .prepare(
        `select id, storage_path, caption, created_at
           from photos where trip_id = ? order by created_at asc`,
      )
      .bind(trip.id),
  )

  // The trips either side of this one in the order the index lists them:
  // (start_date, id), so a same-day pair can't come out one way in the list and
  // the other way here. One row each, found by the index on the primary key
  // rather than by walking the table.
  const neighbour = (direction: 'prev' | 'next') =>
    first<{ slug: string; title: string }>(
      db(event)
        .prepare(
          `select slug, title from trips
            where start_date ${direction === 'prev' ? '<' : '>'} ?1
               or (start_date = ?1 and id ${direction === 'prev' ? '<' : '>'} ?2)
            order by start_date ${direction === 'prev' ? 'desc' : 'asc'},
                     id ${direction === 'prev' ? 'desc' : 'asc'}
            limit 1`,
        )
        .bind(trip.start_date, trip.id),
    )

  const [prev, next] = await Promise.all([neighbour('prev'), neighbour('next')])

  return { trip, photos, prev, next }
})
