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

  // Who was there, as they appear. Ordered so the row is stable between loads.
  const attendees = await all<{ initials: string }>(
    db(event)
      .prepare(
        `select p.initials
           from attendances a join people p on p.id = a.person_id
          where a.trip_id = ? order by p.initials asc`,
      )
      .bind(trip.id),
  )

  return { trip, photos, attendees: attendees.map((row) => row.initials) }
})
