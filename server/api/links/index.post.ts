export default defineEventHandler(async (event) => {
  const email = await requireEditor(event)
  const body = (await readBody(event)) ?? {}

  const trip_id = String(body.trip_id ?? '')
  const url = cleanUrl(body.url)
  const label = String(body.label ?? '').trim() || null

  if (!trip_id || !url) {
    throw createError({ statusCode: 400, statusMessage: 'A trip and a link are required' })
  }

  const id = newId()
  await db(event)
    .prepare(
      `insert into links (id, trip_id, url, label, created_by, created_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, trip_id, url, label, email, nowIso())
    .run()

  return first(
    db(event)
      .prepare('select id, url, label, created_at from links where id = ?')
      .bind(id),
  )
})
