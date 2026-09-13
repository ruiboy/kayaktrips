// Covers both trip edits and badge selection — the old `update for
// authenticated` policy made no distinction either.
const EDITABLE = [
  'title',
  'start_date',
  'end_date',
  'start_place',
  'end_place',
  'notes',
  'start_lat',
  'start_lon',
  'end_lat',
  'end_lon',
  'badge_photo_id',
] as const

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  // Addressed by slug, like the GET on this path. Nitro registers one
  // parameter name per path segment, so a sibling route calling it `id` would
  // silently read back undefined — and a trip's slug never changes anyway.
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'No slug' })

  const body = (await readBody(event)) ?? {}

  // Allowlisted rather than spread: the request must not be able to reach
  // `slug` (the trip's URL, already shared) or `created_by` (attribution).
  const fields = EDITABLE.filter((key) => key in body)
  if (!fields.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  if (
    typeof body.start_date === 'string' &&
    typeof body.end_date === 'string' &&
    body.end_date < body.start_date
  ) {
    throw createError({ statusCode: 400, statusMessage: 'End date precedes start date' })
  }

  const assignments = fields.map((key) => `${key} = ?`).join(', ')
  const values = fields.map((key) => body[key] ?? null)

  const row = await first(
    db(event)
      .prepare(
        `update trips set ${assignments} where slug = ?
         returning id, slug, title, start_date, end_date, start_place, end_place,
                   notes, start_lat, start_lon, end_lat, end_lon, badge_photo_id`,
      )
      .bind(...values, slug),
  )

  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such trip' })
  return row
})
