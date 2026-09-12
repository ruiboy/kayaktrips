// The client sends an id, never a path. The row is the only thing that can
// name an object for deletion, so there is no request that reaches a file
// the database doesn't already point at.
export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'No id' })

  // Row first, then the object — the order the Supabase version used and for
  // the same reason. The other way round can leave a row pointing at a missing
  // file, which renders as a broken tile; this way can only leave an orphaned
  // object, which nothing lists.
  const row = await first<{ storage_path: string }>(
    db(event)
      .prepare('delete from photos where id = ? returning storage_path')
      .bind(id),
  )
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such photo' })

  await photoBucket(event).delete(row.storage_path)
  return { id }
})
