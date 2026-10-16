export type AssetRole = 'avatar' | 'resume' | 'cover'
export const MiB = 1024 * 1024
export const mediaLimits: Record<AssetRole, number> = { avatar: 2 * MiB, resume: 10 * MiB, cover: 5 * MiB }
export const mimeExtensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' }

export function safeFileName(name: string): string {
  const clean = Array.from(name.trim()).map((char) => char.charCodeAt(0) < 32 || '/\\<>:"|?*'.includes(char) ? '_' : char).join('') || 'file'
  if (clean.length <= 100) return clean
  const extension = clean.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] || ''
  return clean.slice(0, 100 - extension.length) + extension
}

export async function validateMedia(blob: Blob, name: string, role: AssetRole): Promise<string> {
  if (!blob.size) throw new Error('文件为空，请重新选择。')
  if (blob.size > mediaLimits[role]) throw new Error(`文件过大：${role === 'resume' ? '简历最多 10' : role === 'avatar' ? '头像最多 2' : '项目封面最多 5'} MiB。`)
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  let mime = ''
  if (ascii(0, 5) === '%PDF-') mime = 'application/pdf'
  else if (bytes[0] === 137 && ascii(1, 4) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) mime = 'image/png'
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg'
  else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') mime = 'image/webp'
  const extension = name.toLowerCase().split('.').pop()
  const accepted = role === 'resume' ? ['application/pdf'] : ['image/jpeg', 'image/png', 'image/webp']
  const extensionMatches = mime === 'image/jpeg' ? extension === 'jpg' || extension === 'jpeg' : extension === mimeExtensions[mime]
  if (!accepted.includes(mime) || !extensionMatches) throw new Error(role === 'resume' ? '请选择真实的 PDF 文件，扩展名必须为 .pdf。' : '请选择真实的 JPEG、PNG 或 WebP 图片，不支持 SVG。')
  if (blob.type && blob.type.toLowerCase().split(';')[0] !== mime) throw new Error('文件声明的类型与实际内容不一致，请重新选择。')
  return mime
}

async function decodeImage(blob: Blob) {
  try {
    const image = await createImageBitmap(blob)
    if (!image.width || !image.height || image.width * image.height > 40_000_000) {
      image.close()
      throw new Error('图片尺寸过大，请压缩后重新上传。')
    }
    return image
  } catch (error) {
    throw new Error(error instanceof Error && error.message.includes('尺寸') ? error.message : '图片无法解码，请选择有效图片。', { cause: error })
  }
}

export async function verifyImage(blob: Blob): Promise<void> {
  const image = await decodeImage(blob)
  image.close()
}

export async function prepareImage(blob: Blob, role: 'avatar' | 'cover'): Promise<Blob> {
  const image = await decodeImage(blob)
  try {
    const maximum = role === 'avatar' ? 512 : 1600
    const ratio = Math.min(1, maximum / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * ratio))
    canvas.height = Math.max(1, Math.round(image.height * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法处理图片。')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('图片压缩失败。')), 'image/webp', .86))
  } finally { image.close() }
}
