// Make build/icon.png and build/icon.ico from build/icon.svg.
// Run with: npm run icons
// It uses Electron to draw the SVG, so it needs no other packages.
const { app, BrowserWindow, nativeImage } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const buildDir = join(__dirname, '..', 'build')
const svg = readFileSync(join(buildDir, 'icon.svg'), 'utf8')
const icoSizes = [16, 24, 32, 48, 64, 128, 256]

/** Draw the SVG at one size and return the PNG bytes. */
async function render(size) {
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
  const html =
    '<html><body style="margin:0;background:transparent;overflow:hidden">' +
    `<img src="${src}" width="${size}" height="${size}" style="display:block"></body></html>`
  await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'))
  await new Promise((resolve) => setTimeout(resolve, 200))
  let image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  win.destroy()
  // If Windows display scaling made the capture bigger, bring it back to the size.
  if (image.getSize().width !== size) image = image.resize({ width: size, height: size, quality: 'best' })
  return image.toPNG()
}

/** Put PNG images into one .ico file (Windows Vista and later read PNG inside .ico). */
function makeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const entries = []
  let offset = 6 + 16 * images.length
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    entries.push(entry)
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  // Draw once at a large size, then shrink. Very small windows do not load reliably.
  const big = nativeImage.createFromBuffer(await render(1024))
  const shrink = (size) => big.resize({ width: size, height: size, quality: 'best' }).toPNG()
  writeFileSync(join(buildDir, 'icon.png'), shrink(512))
  const images = icoSizes.map((size) => ({ size, png: shrink(size) }))
  writeFileSync(join(buildDir, 'icon.ico'), makeIco(images))
  console.log('Wrote build/icon.png and build/icon.ico')
  app.quit()
})
