export type ImageType = 'image/png' | 'image/jpeg' | 'image/svg+xml';

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
};

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const SVG_PROLOG =
  /^(\s|<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)*<svg[\s>]/i;
const SVG_PROBE_LENGTH = 4096;
const BYTE_ORDER_MARK = 0xfeff;

function startsWith(data: Buffer, signature: Buffer): boolean {
  return data.subarray(0, signature.length).equals(signature);
}

// Le type est déduit du contenu du fichier : le nom et le type annoncés par le client
// ne sont pas fiables.
export function detectImageType(data: Buffer): ImageType | null {
  if (startsWith(data, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWith(data, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  const text = data.subarray(0, SVG_PROBE_LENGTH).toString('utf8');
  const start = text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
  return SVG_PROLOG.test(start) ? 'image/svg+xml' : null;
}
