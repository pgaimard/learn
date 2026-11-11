import { crc32 } from 'node:zlib';

// Fabrique une archive .zip sans compression, suffisante pour les tests d'import.
export function createZip(files: Record<string, Buffer | string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content)
      ? content
      : Buffer.from(content, 'utf8');
    const fileName = Buffer.from(name, 'utf8');
    const common = Buffer.alloc(26);
    common.writeUInt16LE(20, 0); // version requise
    common.writeUInt16LE(0x0800, 2); // noms en UTF-8
    common.writeUInt32LE(crc32(data), 10);
    common.writeUInt32LE(data.length, 14);
    common.writeUInt32LE(data.length, 18);
    common.writeUInt16LE(fileName.length, 22);
    const local = Buffer.concat([
      Buffer.from('PK\x03\x04', 'latin1'),
      common,
      fileName,
      data,
    ]);
    const central = Buffer.alloc(46);
    central.write('PK\x01\x02', 0, 'latin1');
    central.writeUInt16LE(20, 4);
    common.copy(central, 6);
    central.writeUInt32LE(offset, 42);
    localParts.push(local);
    centralParts.push(Buffer.concat([central, fileName]));
    offset += local.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.write('PK\x05\x06', 0, 'latin1');
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}
