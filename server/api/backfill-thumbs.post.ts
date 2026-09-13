// One-shot backfill for photos that predate thumbnails. Editor-only, and safe
// to run repeatedly: it skips anything that already has one, and makeThumb
// returns null rather than throwing when a transform fails or loses on size.
//
// Delete this route once the backfill is done — it exists for the migration.
export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const rows = await all<{ id: string; storage_path: string }>(
    db(event).prepare('select id, storage_path from photos order by created_at'),
  )

  const bucket = photoBucket(event)
  const result = { total: rows.length, made: 0, skipped: 0, existing: 0 }

  for (const row of rows) {
    const key = thumbKey(row.storage_path)
    if (await bucket.head(key)) {
      result.existing++
      continue
    }
    const made = await makeThumb(event, row.storage_path)
    if (made) result.made++
    else result.skipped++
  }

  return result
})
