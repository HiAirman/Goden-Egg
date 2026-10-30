import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { exec } from 'node:child_process'
import { clearState, getInfo, readState, writeState } from './server/stateStore.mjs'

// When bundled by pkg, __dirname points inside the read-only snapshot.
// When running from source, fall back to the current working directory.
const moduleDir = typeof __dirname === 'string' ? __dirname : process.cwd()
const root = process.pkg ? resolve(moduleDir, 'dist') : resolve(process.cwd(), 'dist')
const port = Number(process.env.PORT || 4173)
let activePort = port
let portRetries = 0
const host = process.env.HOST || '127.0.0.1'
const shouldOpen = process.argv.includes('--open') || Boolean(process.pkg && !process.argv.includes('--no-open'))
const MAX_BODY = 30 * 1024 * 1024

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

const hasDist = existsSync(join(root, 'index.html'))

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJsonBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        const error = new Error('请求体超过 30MB')
        error.code = 'BODY_TOO_LARGE'
        reject(error)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolveBody(text ? JSON.parse(text) : null)
      } catch {
        const error = new Error('请求体不是合法 JSON')
        error.code = 'INVALID_JSON'
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

async function handleApi(req, res, url) {
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, service: 'god-en-egg', now: new Date().toISOString() })
      return
    }

    if (url.pathname === '/api/state') {
      if (req.method === 'GET') {
        const result = await readState()
        sendJson(res, 200, { ok: true, ...result })
        return
      }
      if (req.method === 'PUT') {
        const body = await readJsonBody(req)
        const state = body?.state ?? body
        const result = await writeState(state)
        sendJson(res, 200, { ok: true, ...result })
        return
      }
      if (req.method === 'DELETE') {
        const result = await clearState()
        sendJson(res, 200, { ok: true, ...result })
        return
      }
      sendJson(res, 405, { ok: false, error: '不支持的请求方法' })
      return
    }

    if (url.pathname === '/api/info' && req.method === 'GET') {
      const info = await getInfo()
      sendJson(res, 200, { ok: true, ...info })
      return
    }

    sendJson(res, 404, { ok: false, error: '接口不存在' })
  } catch (error) {
    const status = error.code === 'BODY_TOO_LARGE' || error.code === 'INVALID_JSON' ? 400 : 500
    console.error('[api]', error)
    sendJson(res, status, {
      ok: false,
      error: error.message || '本地数据服务异常',
      code: error.code || 'INTERNAL_ERROR',
    })
  }
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}:${activePort}`)

    if (url.pathname.startsWith('/api/')) {
      void handleApi(req, res, url)
      return
    }

    if (!hasDist) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('前端尚未构建。请运行 npm run build，或开发时使用 npm run dev。')
      return
    }

    const decoded = decodeURIComponent(url.pathname)
    let filePath = normalize(join(root, decoded))

    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = join(root, 'index.html')
    }

    const ext = extname(filePath).toLowerCase()
    const content = readFileSync(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': content.length,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
    })
    res.end(content)
  } catch (error) {
    console.error(error)
    res.writeHead(500)
    res.end('Internal Server Error')
  }
})

server.listen(activePort, host, async () => {
  const url = `http://${host}:${activePort}`
  const info = await getInfo().catch(() => null)
  console.log('\n  Goden Egg · 会生金蛋的鸡')
  console.log(`  本地服务已启动：${url}`)
  if (info) console.log(`  数据文件：${info.path}`)
  console.log('  数据保存在本地 data/ 目录，不会上传。')
  if (!hasDist) console.log('  当前只有数据 API；前端请运行 npm run build 或 npm run dev。')
  console.log('  按 Ctrl+C 停止服务。\n')
  if (shouldOpen) {
    const command =
      process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
          ? `open "${url}"`
          : `xdg-open "${url}"`
    exec(command, (error) => {
      if (error) console.log(`请手动在浏览器打开：${url}`)
    })
  }
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    // A second copy should still work: try the next port automatically.
    if (process.pkg && !process.env.PORT && portRetries < 20) {
      portRetries += 1
      activePort += 1
      console.log(`\n[Goden Egg] 端口 ${activePort - 1} 已被占用，尝试 ${activePort}...\n`)
      setTimeout(() => server.listen(activePort, host), 120)
      return
    }
    console.error(`\n[Goden Egg] 端口 ${activePort} 已被占用。关闭占用程序，或设置 PORT 后重试。\n`)
  } else {
    console.error(error)
  }
  process.exit(1)
})
