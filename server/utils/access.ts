import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { H3Event } from 'h3'

// Cloudflare Access is the login, but it is not the authorisation check.
// Access gates whichever paths it is configured for; every route that writes
// verifies the token itself, so a route is safe even if it is reachable
// without passing through a protected path. This is what replaces RLS: in
// Supabase the database refused the write, here this function does.
//
// The token arrives two ways. On an Access-protected path Cloudflare injects
// the `Cf-Access-Jwt-Assertion` header. Everywhere else on the same hostname
// the browser still sends the `CF_Authorization` cookie Access set at login,
// which carries the same JWT — that is what lets a public page find out
// whether its viewer is an editor.

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function keySet(teamDomain: string) {
  // Cached across requests within an isolate; jose handles its own key
  // rotation and refresh, so re-creating it per request would only cost
  // fetches.
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
    )
  }
  return jwks
}

function tokenFrom(event: H3Event): string | null {
  const header = getRequestHeader(event, 'cf-access-jwt-assertion')
  if (header) return header
  return getCookie(event, 'CF_Authorization') ?? null
}

/**
 * The verified editor's email, or null if the request carries no valid Access
 * token. Never throws on a bad token — an anonymous visitor is the normal
 * case on every public page.
 */
export async function editorEmail(event: H3Event): Promise<string | null> {
  const { accessTeamDomain, accessAud, devEditorEmail } = useRuntimeConfig(event)

  // Local dev has no Access in front of it. This only opens when the build is
  // a dev build *and* the variable is set deliberately, so a production
  // bundle ignores it even if the variable somehow reaches the environment.
  if (import.meta.dev && devEditorEmail) return devEditorEmail as string

  if (!accessTeamDomain || !accessAud) {
    // Fail closed. An unconfigured deployment refuses writes rather than
    // accepting them from anyone.
    return null
  }

  const token = tokenFrom(event)
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, keySet(accessTeamDomain as string), {
      issuer: `https://${accessTeamDomain}`,
      audience: accessAud as string,
    })
    const email = payload.email
    return typeof email === 'string' ? email : null
  } catch {
    // Expired, wrong audience, bad signature — all the same answer here.
    return null
  }
}

/**
 * The verified editor's email, or a 401. Use on every route that writes.
 */
export async function requireEditor(event: H3Event): Promise<string> {
  const email = await editorEmail(event)
  if (!email) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in to edit' })
  }
  return email
}
