// Writes a file into the assets directory whose contents differ every build.
//
// Works around cloudflare/workers-sdk#12586: the asset upload session can
// return empty buckets even when the manifest holds genuinely new hashes, so
// wrangler reports "No updated asset files to upload" and the previous build
// keeps serving — the deploy succeeds and changes nothing. It cost most of an
// afternoon to find, because every layer reported success.
//
// One guaranteed-changed asset makes the session process the whole manifest.
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const sha = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'nogit'
  }
})()

const stamp = `${sha} ${new Date().toISOString()}\n`
const path = join(process.cwd(), '.output', 'public', '_build-id.txt')
writeFileSync(path, stamp)
console.log(`stamped ${path.replace(process.cwd() + '/', '')}: ${stamp.trim()}`)
