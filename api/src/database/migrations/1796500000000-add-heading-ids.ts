import { randomBytes } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

interface Node {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
}

type Documents = Record<string, Node | null>;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const TABLES = ['courses', 'course_snapshots'];
const COLUMNS = ['content', 'sheet_content', 'exercises_content'];

function newId(): string {
  return Array.from(
    randomBytes(8),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join('');
}

function mapHeadings(node: Node, change: (heading: Node) => Node): Node {
  if (node.type === 'heading') {
    return change(node);
  }
  return node.content
    ? {
        ...node,
        content: node.content.map((child) => mapHeadings(child, change)),
      }
    : node;
}

function withId(heading: Node): Node {
  return { ...heading, attrs: { ...heading.attrs, id: newId() } };
}

function withoutId(heading: Node): Node {
  const attrs = { ...heading.attrs };
  delete attrs['id'];
  return { ...heading, attrs };
}

async function rewrite(
  queryRunner: QueryRunner,
  change: (heading: Node) => Node,
): Promise<void> {
  for (const table of TABLES) {
    const rows = (await queryRunner.query(
      `SELECT id, ${COLUMNS.join(', ')} FROM ${table}`,
    )) as ({ id: number } & Documents)[];
    for (const row of rows) {
      const documents = COLUMNS.map((column) => {
        const document = row[column];
        return document ? JSON.stringify(mapHeadings(document, change)) : null;
      });
      await queryRunner.query(
        `UPDATE ${table}
            SET content = $2::jsonb, sheet_content = $3::jsonb,
                exercises_content = $4::jsonb
          WHERE id = $1`,
        [row.id, ...documents],
      );
    }
  }
}

// Identifiant stable des titres : chaque titre des cours enregistrés, et de leurs
// instantanés, en reçoit un. Seuls les documents changent : ni révision, ni date.
export class AddHeadingIds1796500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await rewrite(queryRunner, withId);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await rewrite(queryRunner, withoutId);
  }
}
