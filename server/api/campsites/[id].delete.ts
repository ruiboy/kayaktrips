export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'No id' })

  const row = await first<{ id: string }>(
    db(event).prepare('delete from campsites where id = ? returning id').bind(id),
  )
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such campsite' })
  return { id: row.id }
})
