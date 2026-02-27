/**
 * pdf-extract.ts
 *
 * Position-aware PDF text extraction using pdfjs-dist directly.
 * Reconstructs word spaces from character X coordinates, fixing PDFs
 * where spaces are stored as positional offsets rather than space chars.
 */

import path from 'path'
import { pathToFileURL } from 'url'

let _pdfjs: any = null

async function getPdfjs() {
  if (!_pdfjs) {
    _pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as any)
    _pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
    ).href
  }
  return _pdfjs
}

export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const pdfjsLib = await getPdfjs()

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      verbosity: 0,
    })

    const pdf = await loadingTask.promise
    const pageTexts: string[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      let pageText = ''
      let prevItem: any = null

      for (const raw of textContent.items) {
        const item = raw as any
        if (!('str' in item) || !item.str) continue

        if (prevItem) {
          const prevY = prevItem.transform[5]
          const currY = item.transform[5]
          const fontSize = Math.abs(item.transform[0]) || 10
          const yDiff = Math.abs(currY - prevY)

          if (yDiff > fontSize * 0.5) {
            pageText += '\n'
          } else {
            const gap = item.transform[4] - (prevItem.transform[4] + (prevItem.width ?? 0))
            if (gap > fontSize * 0.15 && !pageText.endsWith(' ') && !item.str.startsWith(' ')) {
              pageText += ' '
            }
          }
        }

        pageText += item.str
        prevItem = item
      }

      pageTexts.push(pageText.trim())
    }

    const full = pageTexts.filter(Boolean).join('\n\n').trim()
    return full.length >= 30 ? full : null
  } catch {
    return null
  }
}
