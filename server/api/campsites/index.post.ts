export default defineEventHandler(async (event) => {
  const email = await requireEditor(event)
  const body = (await readBody(event)) ?? {}

  const trip_id = String(body.trip_id ?? '')
  const name = String(body.name ?? '').trim()
  const camped_on = String(body.camped_on ?? '')

  if (!trip_id || !name || !camped_on) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  const id = newId()
  await db(event)
    .prepare(
      `insert into campsites
         (id, trip_id, name, camped_on, notes, lat, lon,
          bankage, campspots, firewood, shelter, aesthetics,
          created_by, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      trip_id,
      name,
      camped_on,
      body.notes ?? null,
      body.lat ?? null,
      body.lon ?? null,
      body.bankage ?? null,
      body.campspots ?? null,
      body.firewood ?? null,
      body.shelter ?? null,
      body.aesthetics ?? null,
      email,
      nowIso(),
    )
    .run()

  // Read back rather than echo: `score` is generated, and computing it here
  // would duplicate the rule the database already owns.
  return first(
    db(event)
      .prepare(
        `select id, name, camped_on, notes, lat, lon, bankage, campspots,
                firewood, shelter, aesthetics, score
           from campsites where id = ?`,
      )
      .bind(id),
  )
})
