export const avatarMaxBytes = 64 * 1024;

// Canvas encoders may attach a color profile. Store only the still image chunks.
export function stripAvatarMetadata(bytes: Uint8Array) {
  if (bytes.length < 20 || bytes.length > avatarMaxBytes + 8192) throw new Error("Invalid avatar");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), chunks: Uint8Array[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = String.fromCharCode(...bytes.slice(offset, offset + 4)), size = view.getUint32(offset + 4, true), next = offset + 8 + size + size % 2;
    if (next > bytes.length) throw new Error("Invalid avatar");
    if (!["ICCP", "EXIF", "XMP "].includes(kind)) {
      if (!["VP8X", "VP8 ", "VP8L", "ALPH"].includes(kind)) throw new Error("Invalid avatar");
      const chunk = bytes.slice(offset,next);
      if (kind === "VP8X") { if (size !== 10 || chunk[8] & 2) throw new Error("Animated avatar"); chunk[8] &= 0x10; }
      chunks.push(chunk);
    }
    offset = next;
  }
  if (offset !== bytes.length) throw new Error("Invalid avatar");
  const result = new Uint8Array(12 + chunks.reduce((total,chunk)=>total+chunk.length,0));
  result.set(bytes.slice(0,12));new DataView(result.buffer).setUint32(4,result.length-8,true);offset=12;
  for (const chunk of chunks) {result.set(chunk,offset);offset+=chunk.length;}
  inspectAvatar(result,"image/webp");
  return result;
}

// Validate the small, still WebP produced by the browser, without decoding files on the server.
export function inspectAvatar(bytes: Uint8Array, mime: string) {
  const text = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime !== "image/webp" || bytes.length < 30 || bytes.length > avatarMaxBytes || text(0, 4) !== "RIFF" || text(8, 4) !== "WEBP" || view.getUint32(4, true) !== bytes.length - 8) throw new Error("Invalid avatar");
  let images = 0, offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = text(offset, 4), size = view.getUint32(offset + 4, true), start = offset + 8;
    if (start + size > bytes.length || !["VP8 ", "VP8L", "VP8X", "ALPH"].includes(kind)) throw new Error("Invalid avatar");
    let width = 0, height = 0;
    if (kind === "VP8 ") {
      if (size < 12 || bytes[start] & 1 || text(start + 3, 3) !== "\x9d\x01\x2a") throw new Error("Invalid avatar");
      width = view.getUint16(start + 6, true) & 0x3fff; height = view.getUint16(start + 8, true) & 0x3fff; images++;
    } else if (kind === "VP8L") {
      if (size < 6 || bytes[start] !== 0x2f) throw new Error("Invalid avatar");
      const packed = view.getUint32(start + 1, true);
      width = (packed & 0x3fff) + 1; height = ((packed >>> 14) & 0x3fff) + 1; images++;
    } else if (kind === "VP8X") {
      if (size !== 10 || bytes[start] & ~0x10) throw new Error("Invalid avatar");
      width = 1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16);
      height = 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16);
    }
    if (kind !== "ALPH" && (width !== 256 || height !== 256)) throw new Error("Invalid avatar dimensions");
    offset = start + size + (size % 2);
  }
  if (offset !== bytes.length || images !== 1) throw new Error("Invalid avatar");
}
