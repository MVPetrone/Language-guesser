// Minimal static server for the prebuilt dist/ (no vite dev server — this
// host is memory-constrained). Serves dist/ under the Pages base path.
// Usage: node scripts/serve-dist.mjs [port]
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = '/Language-guesser/'
const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname === '/' || url.pathname === BASE.slice(0, -1)) {
    res.writeHead(302, { location: BASE + url.search })
    return res.end()
  }
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404)
    return res.end('Not found')
  }
  let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html'
  const file = normalize(join(DIST, rel))
  if (!file.startsWith(DIST)) {
    res.writeHead(403)
    return res.end()
  }
  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('not a file')
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': info.size,
    })
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${DIST} at http://127.0.0.1:${PORT}${BASE}`)
})
