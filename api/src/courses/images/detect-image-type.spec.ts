import { detectImageType } from './detect-image-type.js';

describe('detectImageType', () => {
  it('reconnaît un PNG à sa signature', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
    ]);

    expect(detectImageType(png)).toBe('image/png');
  });

  it('reconnaît un JPEG à sa signature', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe(
      'image/jpeg',
    );
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    String.fromCharCode(0xfeff) +
      '<?xml version="1.0"?> <!-- schéma --> <svg viewBox="0 0 1 1"/>',
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd"><svg></svg>',
  ])('reconnaît un SVG : %s', (svg) => {
    expect(detectImageType(Buffer.from(svg))).toBe('image/svg+xml');
  });

  it.each([
    ['du HTML', '<html><svg></svg></html>'],
    ['un GIF', 'GIF89a...'],
    ['un script', '<script>alert(1)</script>'],
    ['un fichier vide', ''],
  ])('refuse %s', (_label, content) => {
    expect(detectImageType(Buffer.from(content))).toBeNull();
  });
});
