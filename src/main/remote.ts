import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { basename, extname, join, relative, resolve } from 'node:path'
import type {
  AudioState,
  RemoteCommand,
  RemoteGroup,
  RemoteSettings,
  RemoteState,
  RemoteStatus,
  ServiceItem,
  ServiceState,
  Settings
} from '../shared/types'
import { cacheFile, mimeType } from './protocol'
import { saveSettings } from './settings'

// Remote control on the local network (SPEC section 11): a small web server
// that serves the remote page, sends it the state, and runs its commands.

let settings: Settings
let hooks: {
  state: () => RemoteState
  run: (cmd: RemoteCommand) => void
  onStatus: (status: RemoteStatus) => void
}

let server: Server | null = null
let error: string | null = null
/** Signed-in browsers (cookie values). Kept in memory only: a restart signs all remotes out. */
const tokens = new Set<string>()
/** Open event streams. */
const clients = new Set<ServerResponse>()
/** Wrong PINs by address. */
const failures = new Map<string, { count: number; until: number }>()

const cookieName = 'mc_remote'
const maxFailures = 5
const lockMs = 60_000
const sendEveryMs = 250

const staticTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
}

function randomPin(): string {
  return String(randomInt(0, 10000)).padStart(4, '0')
}

function remoteSettings(): RemoteSettings {
  return settings.remote!
}

export function connectRemote(s: Settings, h: typeof hooks): void {
  settings = s
  hooks = h
  if (!settings.remote) {
    settings.remote = { enabled: false, port: 5050, pin: randomPin() }
    saveSettings(settings)
  }
  if (remoteSettings().enabled) start()
}

export function remoteStatus(): RemoteStatus {
  const r = remoteSettings()
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => `http://${a!.address}:${r.port}`)
  return { ...r, addresses, clients: clients.size, error }
}

export function updateRemote(change: Partial<RemoteSettings>): RemoteStatus {
  const before = remoteSettings()
  const next: RemoteSettings = { ...before }
  if (typeof change.enabled === 'boolean') next.enabled = change.enabled
  if (typeof change.pin === 'string' && /^\d{4,8}$/.test(change.pin)) next.pin = change.pin
  if (Number.isInteger(change.port) && change.port! >= 1024 && change.port! <= 65535) next.port = change.port!
  settings.remote = next
  saveSettings(settings)
  // A new PIN signs out all remotes.
  if (next.pin !== before.pin) signOutAll()
  if (!next.enabled) stop()
  else if (!server || next.port !== before.port) {
    stop()
    start()
  }
  statusChanged()
  return remoteStatus()
}

export function stopRemote(): void {
  stop()
}

function statusChanged(): void {
  hooks.onStatus(remoteStatus())
}

function start(): void {
  error = null
  const s = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('Remote request failed:', err)
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })
  s.on('error', (err: NodeJS.ErrnoException) => {
    error = err.code === 'EADDRINUSE' ? 'EADDRINUSE' : err.message
    if (server === s) server = null
    statusChanged()
  })
  s.listen(remoteSettings().port, () => statusChanged())
  server = s
}

function stop(): void {
  for (const c of clients) c.end()
  clients.clear()
  server?.close()
  server?.closeAllConnections()
  server = null
  error = null
}

function signOutAll(): void {
  tokens.clear()
  // Tell open pages to show the PIN screen now, not after their reconnect delay.
  for (const c of clients) c.end('event: signout\ndata:\n\n')
  clients.clear()
}

// ---- State to the remotes ----

let timer: ReturnType<typeof setTimeout> | null = null
let lastJson = ''

/** Call after any change of the service or the audio. Sends at most every 250 ms, and only when something changed. */
export function remoteStateChanged(): void {
  if (!clients.size || timer) return
  timer = setTimeout(() => {
    timer = null
    const json = JSON.stringify(hooks.state())
    if (json === lastJson) return
    lastJson = json
    for (const c of clients) c.write(`data: ${json}\n\n`)
  }, sendEveryMs)
}

/** media://cache/a/b.png → /media/a/b.png, for the remote page. */
function webUrl(url: string | undefined): string | undefined {
  return url?.startsWith('media://cache/') ? `/media/${url.slice('media://cache/'.length)}` : undefined
}

/** The small state the remote page shows. */
export function buildRemoteState(
  state: Pick<ServiceState, 'service' | 'groups' | 'playback' | 'nextItemId' | 'target' | 'overlays' | 'logoUrl'>,
  audio: AudioState,
  find: (id: string) => ServiceItem | undefined,
  ready: (item: ServiceItem) => boolean
): RemoteState {
  const groups: RemoteGroup[] = state.groups.map(({ config, live }) => {
    const c = live.content
    const item = c ? find(c.itemId) : undefined
    const page = c?.page ?? 0
    return {
      id: config.id,
      name: config.name,
      content: c
        ? {
            itemId: c.itemId,
            title: item?.title ?? '',
            type: c.type,
            take: c.take,
            playing: c.playing,
            ...(c.type === 'slides' ? { page, pageCount: c.pageUrls?.length ?? 1 } : {}),
            pictureUrl: webUrl(c.type === 'slides' ? c.pageUrls?.[page] : c.type === 'image' ? c.url : undefined)
          }
        : null,
      text: live.text ? { title: live.text.title, index: live.text.index, count: live.text.screens.length } : null
    }
  })
  const takes = new Set(groups.map((g) => g.content?.take))
  const playback: RemoteState['playback'] = {}
  for (const [take, p] of Object.entries(state.playback)) {
    // Whole seconds: the remote does not need more, and fewer changes means fewer messages.
    if (takes.has(Number(take))) playback[Number(take)] = { time: Math.floor(p.currentTime), duration: Math.floor(p.duration), playing: p.playing }
  }
  const track = audio.settings.playlist[audio.index]
  return {
    serviceName: state.service.name,
    items: state.service.items.map((i) => ({ id: i.id, title: i.child?.title ?? i.title, type: i.type, status: i.status, ready: ready(i) })),
    nextItemId: state.nextItemId,
    target: state.target,
    groups,
    playback,
    overlays: state.overlays,
    hasLogo: !!state.logoUrl,
    music: {
      title: track ? basename(track.path, extname(track.path)) : null,
      playing: audio.playing,
      hasPlaylist: audio.settings.playlist.length > 0
    },
    audioItem: audio.item ? { title: audio.item.title, playing: audio.item.playing } : null
  }
}

// ---- Requests ----

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://remote')
  const path = url.pathname

  if (path.startsWith('/api/')) {
    // Commands only from the remote page itself (not from another web site).
    if (req.method === 'POST' && !sameOrigin(req)) return send(res, 403)
    if (path === '/api/login' && req.method === 'POST') return login(req, res)
    if (!signedIn(req)) return send(res, 401)
    if (path === '/api/session') return send(res, 204)
    if (path === '/api/events' && req.method === 'GET') return events(req, res)
    if (path === '/api/command' && req.method === 'POST') return command(req, res)
    return send(res, 404)
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405)
  if (path.startsWith('/media/')) {
    if (!signedIn(req)) return send(res, 401)
    const file = cacheFile(path.slice('/media'.length))
    if (!file) return send(res, 404)
    return sendFile(res, file, mimeType(file), 'private, max-age=300')
  }
  return page(req, res, path)
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status)
    res.end()
  } else {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }
}

function sendFile(res: ServerResponse, file: string, type: string, cache: string): void {
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': statSync(file).size, 'Cache-Control': cache })
  createReadStream(file).pipe(res)
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true // Old browsers and same-origin GET-like requests send no Origin.
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

function cookieToken(req: IncomingMessage): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === cookieName && v) return v
  }
  return null
}

function signedIn(req: IncomingMessage): boolean {
  const t = cookieToken(req)
  return !!t && tokens.has(t)
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 10_000) throw new Error('Request too big')
  }
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function samePin(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

async function login(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ip = req.socket.remoteAddress ?? ''
  const now = Date.now()
  let f = failures.get(ip)
  if (f && f.until > now) return send(res, 429, { waitSeconds: Math.ceil((f.until - now) / 1000) })
  if (f?.until) f = undefined // The wait is over: count again from 0.
  const body = (await readJson(req)) as { pin?: unknown } | null
  const pin = typeof body?.pin === 'string' ? body.pin : ''
  if (!samePin(pin, remoteSettings().pin)) {
    const count = (f?.count ?? 0) + 1
    failures.set(ip, { count, until: count >= maxFailures ? now + lockMs : 0 })
    return send(res, 401)
  }
  failures.delete(ip)
  const token = randomBytes(24).toString('hex')
  tokens.add(token)
  res.writeHead(204, { 'Set-Cookie': `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000` })
  res.end()
}

function events(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.write(`data: ${JSON.stringify(hooks.state())}\n\n`)
  // A comment line now and then keeps the connection open through Wi-Fi sleep and routers.
  const ping = setInterval(() => res.write(': ping\n\n'), 15_000)
  clients.add(res)
  statusChanged()
  req.on('close', () => {
    clearInterval(ping)
    clients.delete(res)
    statusChanged()
  })
}

async function command(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const cmd = parseCommand(await readJson(req))
  if (!cmd) return send(res, 400)
  hooks.run(cmd)
  send(res, 204)
}

/** Accept only the known commands, with arguments of the right type. */
export function parseCommand(x: unknown): RemoteCommand | null {
  if (!x || typeof x !== 'object') return null
  const c = x as Record<string, unknown>
  const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 200
  const bool = (v: unknown): v is boolean => typeof v === 'boolean'
  const int = (v: unknown): v is number => Number.isInteger(v)
  switch (c.name) {
    case 'next':
    case 'previous':
    case 'clearText':
    case 'musicPlay':
    case 'musicPause':
    case 'musicNext':
    case 'musicFadeOut':
      return { name: c.name }
    case 'goLive':
      return str(c.itemId) ? { name: 'goLive', itemId: c.itemId } : null
    case 'setTarget':
      return str(c.target) ? { name: 'setTarget', target: c.target } : null
    case 'pageStep':
      return c.delta === 1 || c.delta === -1 ? { name: 'pageStep', delta: c.delta } : null
    case 'clear':
      return c.groupId === undefined || str(c.groupId) ? { name: 'clear', groupId: c.groupId as string | undefined } : null
    case 'overlay':
      return (c.overlay === 'black' || c.overlay === 'logo') && bool(c.on) ? { name: 'overlay', overlay: c.overlay, on: c.on } : null
    case 'setPlaying':
      return int(c.take) && bool(c.playing) ? { name: 'setPlaying', take: c.take, playing: c.playing } : null
    case 'seekBy':
      return int(c.take) && typeof c.seconds === 'number' && Math.abs(c.seconds) <= 600
        ? { name: 'seekBy', take: c.take, seconds: c.seconds }
        : null
    case 'audioItemPlaying':
      return bool(c.playing) ? { name: 'audioItemPlaying', playing: c.playing } : null
    default:
      return null
  }
}

// ---- The remote page ----

function page(req: IncomingMessage, res: ServerResponse, path: string): void {
  const file = path === '/' ? '/remote.html' : path
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) return proxy(req, res, new URL(file + new URL(req.url ?? '/', 'http://x').search, devUrl))
  // A build: only the remote page and the files it loads.
  if (file !== '/remote.html' && !file.startsWith('/assets/')) return send(res, 404)
  const root = join(__dirname, '../renderer')
  let full: string
  try {
    full = resolve(root, '.' + decodeURIComponent(file))
  } catch {
    return send(res, 404)
  }
  const inside = relative(root, full)
  if (!inside || inside.startsWith('..') || !existsSync(full) || !statSync(full).isFile()) return send(res, 404)
  const type = staticTypes[extname(full).toLowerCase()] ?? 'application/octet-stream'
  sendFile(res, full, type, file === '/remote.html' ? 'no-cache' : 'public, max-age=86400')
}

/** Dev mode: the page and its modules come from the Vite dev server. */
function proxy(req: IncomingMessage, res: ServerResponse, target: URL): void {
  const p = httpRequest(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers)
    r.pipe(res)
  })
  p.on('error', () => send(res, 502))
  req.pipe(p)
}
