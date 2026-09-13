// Deleting a trip is the one destructive act with reach beyond its own row.
// Campsites cascade away with it — they have no meaning apart from the trip.
// Photos do not: `photos.trip_id` is `on delete set null`, so they survive as
// unfiled records in the gallery, and their storage objects are left alone.
// That asymmetry is deliberate and documented in CLAUDE.md.
export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'No slug' })

  // Counted before the delete, because afterwards there is nothing to count.
  // The dialog shows these back to the reader before asking them to type the
  // trip's name.
  const trip = await first<{ id: string; title: string }>(
    db(event).prepare('select id, title from trips where slug = ?').bind(slug),
  )
  if (!trip) throw createError({ statusCode: 404, statusMessage: 'No such trip' })

  const counts = await first<{ campsites: number; photos: number }>(
    db(event)
      .prepare(
        `select (select count(*) from campsites where trip_id = ?1) as campsites,
                (select count(*) from photos    where trip_id = ?1) as photos`,
      )
      .bind(trip.id),
  )

  await db(event).prepare('delete from trips where id = ?').bind(trip.id).run()

  return {
    slug,
    title: trip.title,
    campsitesDeleted: counts?.campsites ?? 0,
    photosUnfiled: counts?.photos ?? 0,
  }
})
