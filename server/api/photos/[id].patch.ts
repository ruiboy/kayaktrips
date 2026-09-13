// Captions only, deliberately.
//
// Photos were designed to be filed at upload time and never edited — under
// Supabase there was no update policy, so the database refused outright.
// Fixing a caption is worth allowing; re-filing a photo from here is not,
// because `trip_id` is what the trip page and the gallery split on. The
// allowlist is one entry long on purpose.
const EDITABLE = ['caption'] as const

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'No id' })

  const body = (await readBody(event)) ?? {}
  const fields = EDITABLE.filter((key) => key in body)
  if (!fields.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const assignments = fields.map((key) => `${key} = ?`).join(', ')
  // An emptied caption means "no caption", not an empty string: the templates
  // test for null to decide whether to render the line at all.
  const values = fields.map((key) => {
    const value = body[key]
    return typeof value === 'string' ? value.trim() || null : null
  })

  const row = await first(
    db(event)
      .prepare(
        `update photos set ${assignments} where id = ?
         returning id, storage_path, caption, created_at`,
      )
      .bind(...values, id),
  )

  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such photo' })
  return row
})
