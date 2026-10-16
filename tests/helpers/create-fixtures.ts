import { mkdir, writeFile } from 'node:fs/promises'
import { pngBytes, pdfBytes } from './fixtures.ts'

const folder = new URL('../../tmp/qa-fixtures/', import.meta.url)
await mkdir(folder, { recursive: true })
await writeFile(new URL('qa-avatar.png', folder), pngBytes())
await writeFile(new URL('qa-resume.pdf', folder), pdfBytes())
await writeFile(new URL('invalid.pdf', folder), 'Not a PDF')
console.log('已生成本机验收用头像与 PDF，不含个人信息。')
