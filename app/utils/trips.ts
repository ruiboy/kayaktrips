// `start_date` and `end_date` are Postgres `date` columns, so they arrive as
// bare 'YYYY-MM-DD' with no timezone. `new Date(iso)` would read that as UTC
// midnight and render the day before anywhere west of Greenwich, so build the
// date from its parts instead.
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Inclusive: a trip that puts in on the 12th and takes out on the 17th is six
// days, not five. Counted in UTC so a DST boundary inside the trip can't shave
// or add an hour and round the wrong way.
export function tripDayCount(startIso: string, endIso: string): number {
  const start = parseDay(startIso)
  const end = parseDay(endIso)
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((endUtc - startUtc) / 86_400_000) + 1
}

const rangeFormat = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// Collapses shared parts on its own: '12 – 17 Jan 2026', '29 Dec 2025 – 3 Jan 2026'.
export function formatDateRange(startIso: string, endIso: string): string {
  return rangeFormat.formatRange(parseDay(startIso), parseDay(endIso))
}

// Trips are addressed by slug, so the URL reads as the trip's name. Derived
// from the title rather than typed: one less field to fill, and the uniqueness
// error surfaces in the form if two trips ever collide.
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
