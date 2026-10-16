import { MiB } from './media.ts'

export const MAX_ZIP_SIZE = 55 * MiB
export const MAX_EXPANDED_SIZE = 50 * MiB
export const MAX_MANIFEST_SIZE = MiB

// 在解压前检查 ZIP 中央目录，限制声明大小，拒绝路径穿越、加密及 ZIP64。
export function inspectZip(bytes: Uint8Array): Map<string, number> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  function need(offset: number, length: number) { if (offset < 0 || offset + length > bytes.length) throw new Error('ZIP 结构损坏或数据截断。') }
  function u16(offset: number) { need(offset, 2); return view.getUint16(offset, true) }
  function u32(offset: number) { need(offset, 4); return view.getUint32(offset, true) }
  let end = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (u32(offset) === 0x06054b50 && offset + 22 + u16(offset + 20) === bytes.length) { end = offset; break }
  }
  if (end < 0) throw new Error('不是有效的 ZIP 备份。')
  const count = u16(end + 10)
  const directorySize = u32(end + 12)
  const directoryStart = u32(end + 16)
  if (u16(end + 4) || u16(end + 6) || count !== u16(end + 8) || count > 130 || directoryStart + directorySize !== end) throw new Error('不支持分卷、ZIP64 或过多文件的备份。')
  const entries = new Map<string, number>()
  const ranges: [number, number][] = []
  let position = directoryStart
  let total = 0
  for (let index = 0; index < count; index++) {
    if (u32(position) !== 0x02014b50) throw new Error('ZIP 中央目录损坏。')
    need(position, 46)
    const flags = u16(position + 8)
    const method = u16(position + 10)
    const compressed = u32(position + 20)
    const size = u32(position + 24)
    const nameLength = u16(position + 28)
    const extraLength = u16(position + 30)
    const commentLength = u16(position + 32)
    const localOffset = u32(position + 42)
    need(position + 46, nameLength + extraLength + commentLength)
    const rawName = bytes.slice(position + 46, position + 46 + nameLength)
    const name = String.fromCharCode(...rawName)
    if (flags & 1 || ![0, 8].includes(method) || u16(position + 34) !== 0) throw new Error('不支持加密或此压缩方式的备份。')
    if (name.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name) || name.split('/').some((part) => part === '.' || part === '..') || name.includes('//') || entries.has(name)) throw new Error('备份包含不安全或重复的文件路径。')
    total += size
    if (size > 10 * MiB || total > MAX_EXPANDED_SIZE || (name === 'backup.json' && size > MAX_MANIFEST_SIZE)) throw new Error('备份解压大小超限，已停止导入。')
    if (u32(localOffset) !== 0x04034b50 || u16(localOffset + 8) !== method || u16(localOffset + 6) !== flags) throw new Error('ZIP 文件头不一致。')
    const localNameLength = u16(localOffset + 26)
    const localExtraLength = u16(localOffset + 28)
    need(localOffset + 30, localNameLength + localExtraLength)
    const localName = String.fromCharCode(...bytes.slice(localOffset + 30, localOffset + 30 + localNameLength))
    const dataEnd = localOffset + 30 + localNameLength + localExtraLength + compressed
    if (localName !== name || dataEnd > directoryStart) throw new Error('ZIP 文件数据不一致。')
    ranges.push([localOffset, dataEnd])
    entries.set(name, size)
    position += 46 + nameLength + extraLength + commentLength
  }
  ranges.sort((a, b) => a[0] - b[0])
  if (ranges.some((range, index) => index > 0 && range[0] < ranges[index - 1][1]) || position !== directoryStart + directorySize) throw new Error('ZIP 文件数据重叠或目录无效。')
  return entries
}
