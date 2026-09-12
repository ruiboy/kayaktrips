// Public. The badge join replaces the PostgREST embed that had to name the FK
// constraint, since trips and photos reference each other both ways.
export default defineEventHandler(async (event) => {
  const rows = await all<{
    id: string
    slug: string
    title: string
    start_date: string
    end_date: string
    start_place: string | null
    end_place: string | null
    badge_storage_path: string | null
  }>(
    db(event).prepare(
      `select t.id, t.slug, t.title, t.start_date, t.end_date,
              t.start_place, t.end_place,
              p.storage_path as badge_storage_path
         from trips t
         left join photos p on p.id = t.badge_photo_id
        order by t.start_date asc`,
    ),
  )

  // Kept in the shape the page already consumes, so the template is untouched.
  return rows.map(({ badge_storage_path, ...trip }) => ({
    ...trip,
    badge: badge_storage_path ? { storage_path: badge_storage_path } : null,
  }))
})
