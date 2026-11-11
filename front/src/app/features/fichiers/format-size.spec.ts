import { formatSize } from './format-size';

describe('formatSize', () => {
  it.each([
    [0, '0 octets'],
    [512, '512 octets'],
    [1024, '1 ko'],
    [1536, '1,5 ko'],
    [250 * 1024, '250 ko'],
    [50 * 1024 * 1024, '50 Mo'],
    [3.25 * 1024 * 1024 * 1024, '3,3 Go'],
  ])('écrit %d octets « %s »', (bytes, expected) => {
    expect(formatSize(bytes).replace(String.fromCharCode(0xa0), ' ')).toBe(expected);
  });
});
