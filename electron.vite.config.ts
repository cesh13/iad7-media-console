import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** pdf.js loads fonts, character maps, color profiles and wasm files at run time. Copy them next to the pages. */
function copyPdfjsData(): Plugin {
  return {
    name: 'copy-pdfjs-data',
    buildStart() {
      for (const dir of ['cmaps', 'standard_fonts', 'iccs', 'wasm']) {
        const from = resolve(__dirname, 'node_modules/pdfjs-dist', dir)
        const to = resolve(__dirname, 'src/renderer/public/pdfjs', dir)
        if (existsSync(from) && !existsSync(to)) cpSync(from, to, { recursive: true })
      }
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react(), copyPdfjsData()],
    build: {
      rollupOptions: {
        // Pages: the control window, the output (screen) windows, the
        // hidden window that turns PDF pages into pictures, and the remote
        // control page (served to phones by the main process).
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          output: resolve(__dirname, 'src/renderer/output.html'),
          pdf: resolve(__dirname, 'src/renderer/pdf.html'),
          remote: resolve(__dirname, 'src/renderer/remote.html')
        }
      }
    }
  }
})
