/**
 * Leitura de PDF 100% local: PDF.js (texto) + Tesseract.js (OCR, idioma português) como reserva
 * para páginas escaneadas. Nenhum arquivo sai do aparelho e nenhuma chamada de rede externa é feita:
 * o leitor, o worker do OCR, o núcleo WebAssembly e o idioma ficam empacotados no app (public/ocr, public/pdfjs).
 */
export const MAX_PDF_MB = 80
const MIN_TEXT_CHARS = 40 // páginas com menos texto que isso são tratadas como imagem (OCR)

export class PdfError extends Error {
  constructor(message, code = 'unknown', cause) { super(message); this.name = 'PdfError'; this.code = code; this.cause = cause }
}

const asset = (p) => new URL(p, document.baseURI).href

/** Agrupa os itens de texto do PDF.js em linhas (mesma altura = mesma linha) e ordena de cima para baixo. */
export function itemsToText(items) {
  const rows = []
  for (const it of items) {
    if (!('str' in it) || !it.str.trim()) continue
    const y = it.transform[5], x = it.transform[4], h = it.height || Math.abs(it.transform[3]) || 10
    let row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, h * 0.4))
    if (!row) { row = { y, parts: [] }; rows.push(row) }
    row.parts.push({ x, w: it.width || 0, s: it.str })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x)
    let line = '', end = null
    for (const p of r.parts) {
      const gap = end === null ? 0 : p.x - end
      line += (end !== null && gap > 1.5 && !line.endsWith(' ') && !p.s.startsWith(' ') ? ' ' : '') + p.s
      end = p.x + p.w
    }
    return line.replace(/\s+/g, ' ').trim()
  }).filter(Boolean).join('\n')
}

let pdfjsPromise
async function loadPdfjs() {
  pdfjsPromise ||= (async () => {
    const lib = await import('pdfjs-dist/build/pdf.min.mjs')
    const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    lib.GlobalWorkerOptions.workerSrc = worker
    return lib
  })()
  return pdfjsPromise
}

function friendly(err) {
  const n = err?.name || ''
  if (n === 'PasswordException') return new PdfError('O PDF está protegido por senha. Remova a proteção e tente novamente.', 'password', err)
  if (n === 'InvalidPDFException') return new PdfError('O arquivo não parece ser um PDF válido ou está corrompido.', 'invalid', err)
  if (n === 'MissingPDFException') return new PdfError('Não foi possível abrir o arquivo.', 'missing', err)
  return new PdfError('Não foi possível ler o PDF: ' + (err?.message || 'erro desconhecido'), 'read', err)
}

const simdOk = () => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])) } catch { return false } }

async function createOcr(onProgress) {
  const { createWorker } = await import('tesseract.js')
  return createWorker('por', 1, {
    workerPath: asset('ocr/worker.min.js'),
    corePath: asset(simdOk() ? 'ocr/tesseract-core-simd-lstm.wasm.js' : 'ocr/tesseract-core-lstm.wasm.js'),
    langPath: asset('ocr'),
    cacheMethod: 'none',
    logger: (m) => { if (m.status === 'recognizing text') onProgress?.(m.progress) }
  })
}

/**
 * Extrai o texto do PDF. `ocr`: 'auto' (somente páginas sem texto), 'force' (todas) ou 'off'.
 * Retorna { pages:[{page,text,method:'text'|'ocr'|'empty',error?}], pageCount, ocrPages, warnings }.
 * Erros de leitura viram PdfError com mensagem em português; falha de OCR em uma página não derruba as demais.
 */
export async function extractPdf(file, { ocr = 'auto', onProgress } = {}) {
  if (!file) throw new PdfError('Nenhum arquivo selecionado.', 'nofile')
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name || '')) throw new PdfError('Selecione um arquivo PDF.', 'type')
  if (file.size > MAX_PDF_MB * 1024 * 1024) throw new PdfError(`O arquivo tem mais de ${MAX_PDF_MB} MB.`, 'size')
  if (!file.size) throw new PdfError('O arquivo está vazio.', 'empty')
  const report = (stage, current, total, extra = {}) => onProgress?.({ stage, current, total, ...extra })

  let pdfjs, doc
  try {
    pdfjs = await loadPdfjs()
    const data = new Uint8Array(await file.arrayBuffer())
    doc = await pdfjs.getDocument({ data, wasmUrl: asset('pdfjs/wasm/'), isEvalSupported: false }).promise
  } catch (e) { throw friendly(e) }

  const pages = [], warnings = []
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      report('text', n, doc.numPages)
      let text = ''
      if (ocr !== 'force') {
        try { const page = await doc.getPage(n); text = itemsToText((await page.getTextContent()).items) } catch (e) { warnings.push(`Página ${n}: falha ao ler o texto (${e.message}).`) }
      }
      pages.push({ page: n, text, method: text.replace(/\s/g, '').length >= MIN_TEXT_CHARS ? 'text' : 'empty' })
    }
    const needOcr = ocr === 'off' ? [] : pages.filter((p) => ocr === 'force' || p.method === 'empty')
    if (needOcr.length) {
      let worker
      try { report('ocr-init', 0, needOcr.length); worker = await createOcr() } catch (e) {
        warnings.push('O OCR não pôde ser iniciado neste navegador; as páginas escaneadas ficaram sem texto.')
        needOcr.length = 0
        console.error(e)
      }
      let done = 0
      for (const p of needOcr) {
        report('ocr', done, needOcr.length, { page: p.page })
        try {
          const page = await doc.getPage(p.page)
          const base = page.getViewport({ scale: 1 })
          const scale = Math.min(3, Math.max(1.5, 2000 / base.width))
          const vp = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height)
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, canvas }).promise
          const res = await worker.recognize(canvas)
          canvas.width = canvas.height = 0
          p.text = (res.data.text || '').trim(); p.method = p.text ? 'ocr' : 'empty'
          if (!p.text) warnings.push(`Página ${p.page}: o OCR não encontrou texto.`)
        } catch (e) { p.error = e.message; warnings.push(`Página ${p.page}: falha no OCR (${e.message}).`) }
        done++
      }
      try { await worker?.terminate() } catch { /* ignore */ }
    }
  } catch (e) { throw friendly(e) } finally { try { await doc.destroy() } catch { /* ignore */ } }

  const ocrPages = pages.filter((p) => p.method === 'ocr').length
  if (!pages.some((p) => p.text.trim())) throw new PdfError('Não foi possível extrair texto deste PDF (nem por OCR). Tente um arquivo com melhor qualidade.', 'noText')
  report('done', pages.length, pages.length)
  return { pages, pageCount: pages.length, ocrPages, warnings }
}
