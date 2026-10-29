import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Hidden window: turn each page of a PDF into a PNG picture, and read the
// text of each page (used later by the search). The main process sends one
// job at a time and saves the pictures in the media cache.

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const api = window.mediaConsole
const dataUrl = (dir: string) => new URL(`./pdfjs/${dir}/`, location.href).toString()

api.onPdfJob(async (job) => {
  try {
    const doc = await pdfjs.getDocument({
      data: job.data,
      cMapUrl: dataUrl('cmaps'),
      cMapPacked: true,
      standardFontDataUrl: dataUrl('standard_fonts'),
      wasmUrl: dataUrl('wasm'),
      iccUrl: dataUrl('iccs')
    }).promise

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      // Slides are drawn to fit the width; tall pages are limited by the height.
      const scale = Math.min(job.width / base.width, job.height / base.height)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const context = canvas.getContext('2d')!
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: context, viewport }).promise
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make a picture of the page'))), 'image/png')
      )
      const text = (await page.getTextContent()).items
        .map((i) => ('str' in i ? i.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      api.pdfPage(job.id, n - 1, doc.numPages, new Uint8Array(await blob.arrayBuffer()), text)
      page.cleanup()
    }
    await doc.cleanup()
    await doc.loadingTask.destroy()
    api.pdfDone(job.id, null)
  } catch (err) {
    api.pdfDone(job.id, err instanceof Error ? err.message : String(err))
  }
})

api.pdfReady()
