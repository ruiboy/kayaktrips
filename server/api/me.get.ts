// Identity probe. Access does not run on public pages, so a page that shows
// editor controls inline has no other way to find out who is looking at it.
// Always 200 — "not an editor" is an answer, not an error.
export default defineEventHandler(async (event) => {
  const email = await editorEmail(event)
  const person = await personFor(event, email)
  // `initials` is null for an editor who isn't in the registry — they can write
  // everything else, and the attendance control hides rather than failing.
  return { email, editor: email !== null, initials: person?.initials ?? null }
})
