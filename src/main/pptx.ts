import { app } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cacheDir } from './cache'

/**
 * Convert PowerPoint files to PDF (SPEC section 3). On Windows, use Microsoft
 * PowerPoint when it is installed: it draws the slides exactly as the author
 * saw them. Otherwise use LibreOffice in headless mode.
 * Animations and embedded video are not supported.
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

/** Microsoft PowerPoint on Windows (Office 2013 and newer, 64-bit and 32-bit). */
export function findPowerPoint(): string | null {
  if (process.platform !== 'win32') return null
  const roots = [process.env['ProgramFiles'] ?? 'C:\Program Files', process.env['ProgramFiles(x86)'] ?? 'C:\Program Files (x86)']
  const found: string[] = []
  for (const root of roots) {
    for (const version of ['Office16', 'Office15']) {
      found.push(join(root, 'Microsoft Office', 'root', version, 'POWERPNT.EXE'))
      found.push(join(root, 'Microsoft Office', version, 'POWERPNT.EXE'))
    }
  }
  return found.find((p) => existsSync(p)) ?? null
}

export class NoConverterError extends Error {
  constructor() {
    super(
      'No program to convert PowerPoint files. Install Microsoft PowerPoint or LibreOffice (libreoffice.org), or save the presentation as PDF.'
    )
  }
}

/**
 * PowerShell script that opens the file in PowerPoint without a window and
 * saves it as PDF (32 = ppSaveAsPDF). If PowerPoint was already open with
 * other presentations, it stays open.
 */
const powerPointScript = `
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
try {
  $pres = $app.Presentations.Open($env:MC_IN, $true, $false, $false)
  try { $pres.SaveAs($env:MC_OUT, 32) } finally { $pres.Close() }
} finally {
  if ($app.Presentations.Count -eq 0) { $app.Quit() }
}
`

// PowerPoint can do only one conversion at a time.
let powerPointQueue: Promise<unknown> = Promise.resolve()

function convertWithPowerPoint(cachedPath: string, pdfPath: string): Promise<string> {
  const run = (): Promise<string> =>
    new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', powerPointScript],
        { timeout: 180_000, windowsHide: true, env: { ...process.env, MC_IN: cachedPath, MC_OUT: pdfPath } },
        (err, _stdout, stderr) => {
          if (existsSync(pdfPath)) resolve(pdfPath)
          else reject(new Error(`PowerPoint could not convert the file: ${stderr?.trim() || err?.message || 'no PDF was made'}`))
        }
      )
    })
  const job = powerPointQueue.then(run, run)
  powerPointQueue = job.catch(() => undefined)
  return job
}

/** Convert one file. The PDF goes next to the cached copy, with the same name. */
export async function convertToPdf(cachedPath: string, customSoffice?: string): Promise<string> {
  const outDir = cacheDir()
  const pdfPath = join(outDir, `${basename(cachedPath, extname(cachedPath))}.pdf`)
  if (existsSync(pdfPath)) return pdfPath
  const soffice = findSoffice(customSoffice)
  if (findPowerPoint()) {
    try {
      return await convertWithPowerPoint(cachedPath, pdfPath)
    } catch (err) {
      // PowerPoint failed (for example, it is not activated): try LibreOffice.
      if (!soffice) throw err
    }
  }
  if (!soffice) throw new NoConverterError()
  return convertWithLibreOffice(soffice, cachedPath, outDir, pdfPath)
}

function convertWithLibreOffice(soffice: string, cachedPath: string, outDir: string, pdfPath: string): Promise<string> {

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
