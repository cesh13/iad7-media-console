import { app } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cacheDir } from './cache'

/**
 * Convert PowerPoint files to PDF with LibreOffice in headless mode
 * (SPEC section 3). Animations and embedded video are not supported.
 */

function candidates(): string[] {
  if (process.platform === 'win32') {
    return [
      join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'LibreOffice', 'program', 'soffice.exe'),
      join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'LibreOffice', 'program', 'soffice.exe')
    ]
  }
  if (process.platform === 'darwin') return ['/Applications/LibreOffice.app/Contents/MacOS/soffice']
  return ['/usr/bin/soffice', '/usr/local/bin/soffice', '/snap/bin/libreoffice']
}

export function findSoffice(customPath?: string): string | null {
  if (customPath && existsSync(customPath)) return customPath
  return candidates().find((p) => existsSync(p)) ?? null
}

export class NoLibreOfficeError extends Error {
  constructor() {
    super('LibreOffice is not installed. Install it (libreoffice.org), or save the presentation as PDF.')
  }
}

/** Convert one file. The PDF goes next to the cached copy, with the same name. */
export function convertToPdf(cachedPath: string, customSoffice?: string): Promise<string> {
  const soffice = findSoffice(customSoffice)
  if (!soffice) return Promise.reject(new NoLibreOfficeError())
  const outDir = cacheDir()
  const pdfPath = join(outDir, `${basename(cachedPath, extname(cachedPath))}.pdf`)
  if (existsSync(pdfPath)) return Promise.resolve(pdfPath)

  // A separate LibreOffice profile, so the conversion works even when
  // someone has LibreOffice open on this computer.
  const profile = join(app.getPath('userData'), 'libreoffice-profile')
  mkdirSync(profile, { recursive: true })
  const args = [
    `-env:UserInstallation=${pathToFileURL(profile).toString()}`,
    '--headless',
    '--norestore',
    '--convert-to',
    'pdf',
    '--outdir',
    outDir,
    cachedPath
  ]
  return new Promise((resolve, reject) => {
    execFile(soffice, args, { timeout: 180_000, windowsHide: true }, (err, _stdout, stderr) => {
      if (existsSync(pdfPath)) resolve(pdfPath)
      else reject(new Error(`Conversion failed: ${err?.message ?? stderr ?? 'no PDF was made'}`))
    })
  })
}
