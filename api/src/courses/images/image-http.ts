export interface UploadedImageResponse {
  id: number;
  src: string;
  mimeType: string;
  size: number;
  altText: string;
}

// Seule partie utile du fichier reçu en mémoire par multer.
export interface ReceivedFile {
  buffer: Buffer;
}

// En-têtes de toute image servie par l'API.
export function imageHeaders(image: {
  mimeType: string;
  size: number;
}): Record<string, string> {
  return {
    'Content-Type': image.mimeType,
    'Content-Length': String(image.size),
    'X-Content-Type-Options': 'nosniff',
    // Même ouvert directement, un SVG ne peut ni exécuter de script ni charger de ressource.
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'Cache-Control': 'private, max-age=31536000, immutable',
  };
}
