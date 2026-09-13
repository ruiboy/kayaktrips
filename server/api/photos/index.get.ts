// Public. The 60-row cap matches what the gallery asked Supabase for.
export default defineEventHandler(async (event) => {
  const rows = await all<{
    id: string
    storage_path: string
    caption: string | null
    created_at: string
    trip_slug: string | null
    trip_title: string | null
  }>(
    db(event).prepare(
      `select ph.id, ph.storage_path, ph.caption, ph.created_at,
              t.slug as trip_slug, t.title as trip_title
         from photos ph
         left join trips t on t.id = ph.trip_id
        order by ph.created_at desc
        limit 60`,
    ),
  )

  return rows.map(({ trip_slug, trip_title, ...photo }) => ({
    ...photo,
    trip: trip_slug ? { slug: trip_slug, title: trip_title } : null,
  }))
})
