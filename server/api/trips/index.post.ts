// Replaces the `insert for authenticated with created_by = auth.uid()` policy:
// the author is taken from the verified token, never from the request body.
export default defineEventHandler(async (event) => {
  const email = await requireEditor(event)
  const body = await readBody(event)

  const title = String(body?.title ?? '').trim()
  const slug = String(body?.slug ?? '').trim()
  const start_date = String(body?.start_date ?? '')
  const end_date = String(body?.end_date ?? '')

  if (!title || !slug || !start_date || !end_date) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }
  if (end_date < start_date) {
    throw createError({ statusCode: 400, statusMessage: 'End date precedes start date' })
  }

  const id = newId()
  const text = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s || null
  }

  try {
    await db(event)
      .prepare(
        `insert into trips
           (id, slug, title, start_date, end_date, start_place, end_place,
            notes, created_by, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        slug,
        title,
        start_date,
        end_date,
        text(body?.start_place),
        text(body?.end_place),
        text(body?.notes),
        email,
        nowIso(),
      )
      .run()
  } catch (error) {
    // The slug is derived from the title, so a unique violation means the
    // title collides — say that rather than leaking the constraint name.
    if (String(error).includes('UNIQUE')) {
      throw createError({
        statusCode: 409,
        statusMessage: `There's already a trip called "${title}".`,
      })
    }
    throw error
  }

  return { id, slug }
})
