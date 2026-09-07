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

// Stays in the 'YYYY-MM-DD' domain the `date` columns and `<input type="date">`
// both speak, so nothing has to round-trip through a timezone to add a night.
export function isoDayAfter(iso: string): string {
  const day = parseDay(iso)
  day.setDate(day.getDate() + 1)
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

const dayFormat = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export function formatDay(iso: string): string {
  return dayFormat.format(parseDay(iso))
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
