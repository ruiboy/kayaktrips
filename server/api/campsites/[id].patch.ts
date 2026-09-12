const EDITABLE = [
  'name',
  'camped_on',
  'notes',
  'lat',
  'lon',
  'bankage',
  'campspots',
  'firewood',
  'shelter',
  'aesthetics',
] as const

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'No id' })

  const body = (await readBody(event)) ?? {}
  // Allowlisted so a request cannot move a campsite to another trip or
  // rewrite who recorded it.
  const fields = EDITABLE.filter((key) => key in body)
  if (!fields.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const assignments = fields.map((key) => `${key} = ?`).join(', ')
  const values = fields.map((key) => body[key] ?? null)

  const row = await first(
    db(event)
      .prepare(
        `update campsites set ${assignments} where id = ?
         returning id, name, camped_on, notes, lat, lon, bankage, campspots,
                   firewood, shelter, aesthetics, score`,
      )
      .bind(...values, id),
  )

  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such campsite' })
  return row
})
