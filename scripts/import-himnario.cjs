// Copies the hymn pictures and music of the old "Himnario Adventista" program
// into the hymnal folder of this app, and writes himnos.json (titles with
// accents, and the time of each slide change).
//
//   node scripts/import-himnario.cjs "<folder of the old program>" ["<hymnal folder>"]
//
// The hymnal folder is ./himnario when it is not given. Files that are already
// there with the same size are not copied again, so the script can run twice.

const fs = require('node:fs')
const path = require('node:path')

const source = process.argv[2]
const target = path.resolve(process.argv[3] ?? path.join(__dirname, '..', 'himnario'))

if (!source || !fs.existsSync(path.join(source, 'Letra'))) {
  console.error('Usage: node scripts/import-himnario.cjs "<folder of the old program>" ["<hymnal folder>"]')
  console.error('The folder of the old program must have a "Letra" folder inside.')
  process.exit(1)
}

const pictures = new Set(['.jpg', '.jpeg', '.png'])
const music = new Set(['.mp3', '.m4a', '.wav', '.ogg'])
let copied = 0
let kept = 0

/**
 * Copy one file by its content. (A normal file copy on Windows also copies the
 * "hidden" mark of the old program's files, and then the folder looks empty.)
 */
function copyFile(from, to) {
  const size = fs.statSync(from).size
  if (fs.existsSync(to) && fs.statSync(to).size === size) {
    kept++
    return
  }
  fs.writeFileSync(to, fs.readFileSync(from))
  copied++
  if (copied % 250 === 0) console.log(`  ${copied} files copied…`)
}

function copyFolder(from, to, extensions) {
  if (!fs.existsSync(from)) return
  fs.mkdirSync(to, { recursive: true })
  for (const name of fs.readdirSync(from)) {
    if (extensions.has(path.extname(name).toLowerCase())) copyFile(path.join(from, name), path.join(to, name))
  }
}

console.log(`From: ${path.resolve(source)}`)
console.log(`To:   ${target}`)

// Pictures: one folder per hymn ("001 - Cantad alegres al Senor/01.jpg").
for (const dir of fs.readdirSync(path.join(source, 'Letra'), { withFileTypes: true })) {
  if (dir.isDirectory() && /^\d+/.test(dir.name)) {
    copyFolder(path.join(source, 'Letra', dir.name), path.join(target, 'Letra', dir.name), pictures)
  }
}
// Music: sung ("Cantado") and track only ("Instrumental").
for (const kind of ['Cantado', 'Instrumental']) {
  copyFolder(path.join(source, 'Musica', kind), path.join(target, 'Musica', kind), music)
}

// Titles and slide times, from the page of the old program.
const page = path.join(source, 'Resources', 'index.html')
if (fs.existsSync(page)) {
  const html = fs.readFileSync(page, 'utf8')
  const hymns = []
  for (const tag of html.match(/<span class="himn"[^>]*>/g) ?? []) {
    const attr = (name) => (new RegExp(`data-${name}="([^"]*)"`).exec(tag) ?? [])[1] ?? ''
    const number = Number(attr('number'))
    if (!number) continue
    const times = attr('times')
      .split(',')
      .map((t) => Number(t) / 1000)
      .filter((t) => Number.isFinite(t) && t > 0)
    hymns.push({ number, title: attr('title').trim(), times })
  }
  hymns.sort((a, b) => a.number - b.number)
  fs.mkdirSync(target, { recursive: true })
  fs.writeFileSync(path.join(target, 'himnos.json'), JSON.stringify({ hymns }, null, 1), 'utf8')
  console.log(`himnos.json: ${hymns.length} hymns`)
} else {
  console.log('No Resources/index.html: himnos.json was not written (titles come from the folder names).')
}

console.log(`Done. ${copied} files copied, ${kept} already there.`)
