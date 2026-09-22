// Public. A page of the gallery, ordered by trip and then by caption.
//
// The order used to be newest-first, which scattered a trip's photos through
// the list by whenever each was uploaded. Grouping by trip is what someone
// reading the gallery is actually after, and the caption is the only thing
// inside a trip that carries an order at all.
export const PAGE_SIZE = 60

export default defineEventHandler(async (event) => {
  const { page: rawPage } = getQuery(event)
  const asked = Number.parseInt(String(rawPage ?? '1'), 10)

  const totals = await first<{ total: number }>(
    db(event).prepare('select count(*) as total from photos'),
  )
  const total = totals?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Clamped rather than refused: a page number out of range is a stale link or
  // a photo deleted since, and the last page is a better answer than an error.
  const page = Math.min(Math.max(Number.isFinite(asked) ? asked : 1, 1), pageCount)

  const rows = await all<{
    id: string
    storage_path: string
    caption: string | null
    created_at: string
    trip_slug: string | null
    trip_title: string | null
  }>(
    db(event)
      .prepare(
        // `x is null` sorts 0 before 1, so photos with no trip fall to the end
        // of the gallery and, within a trip, the uncaptioned fall to the end of
        // it. `nocase` keeps a capital from jumping the queue. created_at is
        // the tie-break, so the order is total and a page boundary can't repeat
        // or drop a row.
        `select ph.id, ph.storage_path, ph.caption, ph.created_at,
                t.slug as trip_slug, t.title as trip_title
           from photos ph
           left join trips t on t.id = ph.trip_id
          order by t.title is null, t.title collate nocase,
                   ph.caption is null, ph.caption collate nocase,
                   ph.created_at
          limit ? offset ?`,
      )
      .bind(PAGE_SIZE, (page - 1) * PAGE_SIZE),
  )

  return {
    photos: rows.map(({ trip_slug, trip_title, ...photo }) => ({
      ...photo,
      trip: trip_slug ? { slug: trip_slug, title: trip_title } : null,
    })),
    page,
    pageCount,
    total,
  }
})
