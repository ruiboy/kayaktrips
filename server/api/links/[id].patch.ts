// Both of them: a link is a URL and what to call it, and there is nothing else
// on the row a request has any business writing.
const EDITABLE = ['url', 'label'] as const

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'No id' })

  const body = (await readBody(event)) ?? {}
  const fields = EDITABLE.filter((key) => key in body)
  if (!fields.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const values = fields.map((key) => {
    if (key === 'url') {
      const url = cleanUrl(body.url)
      if (!url) throw createError({ statusCode: 400, statusMessage: 'That is not a link' })
      return url
    }
    // An emptied label stores NULL rather than '', the same as a photo's
    // caption: the template tests for null to decide what to call the link.
    return String(body.label ?? '').trim() || null
  })

  const assignments = fields.map((key) => `${key} = ?`).join(', ')
  const row = await first(
    db(event)
      .prepare(
        `update links set ${assignments} where id = ?
         returning id, url, label, created_at`,
      )
      .bind(...values, id),
  )

  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such link' })
  return row
})
