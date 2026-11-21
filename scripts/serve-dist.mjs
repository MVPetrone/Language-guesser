// Minimal static server for the prebuilt dist/ (no vite dev server — this
// host is memory-constrained). Serves dist/ under the Pages base path.
// Usage: node scripts/serve-dist.mjs [port]
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = '/'
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
  if (BASE !== '/' && url.pathname === BASE.slice(0, -1)) {
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
    const type = TYPES[extname(file)] ?? 'application/octet-stream'
    const range = req.headers.range
    // iOS Safari refuses to play <audio> unless the server answers a Range
    // request with 206 + Content-Range. Plain 200 leaves the clip silent.
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null
    if (m) {
      const start = m[1] ? Number(m[1]) : 0
      const end = m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1
      if (start > end || start >= info.size) {
        res.writeHead(416, { 'content-range': `bytes */${info.size}` })
        return res.end()
      }
      res.writeHead(206, {
        'content-type': type,
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${info.size}`,
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      })
      createReadStream(file, { start, end }).pipe(res)
      return
    }
    res.writeHead(200, {
      'content-type': type,
      'content-length': info.size,
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
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
