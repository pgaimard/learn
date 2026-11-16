import { MigrationInterface, QueryRunner } from 'typeorm';

const MAX_LENGTH = 255;

// Nom de dossier tiré du titre d'un cours : sans séparateur de chemin ni caractère de
// contrôle. Copie figée de la règle de l'application au moment de cette migration.
function folderName(title: string): string {
  const name = Array.from(title)
    .map((character) => {
      const code = character.charCodeAt(0);
      return character === '/' ||
        character === '\\' ||
        code < 32 ||
        code === 127
        ? ' '
        : character;
    })
    .join('')
    .trim()
    .slice(0, MAX_LENGTH);
  return name === '' || name === '.' || name === '..' ? 'Cours' : name;
}

function freeName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) {
    return name;
  }
  for (let number = 2; ; number++) {
    const suffix = ` - ${number}`;
    const candidate = name.slice(0, MAX_LENGTH - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
}

interface CourseRow {
  id: number;
  ue_id: number;
  title: string;
}

interface FolderRow {
  id: number;
  name: string;
  course_id: number | null;
}

// Chaque cours a son dossier de fichiers, à la racine de son UE. Un dossier qui porte
// déjà le nom du cours devient le sien ; sinon il est créé.
export class AddCourseFolders1795700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE folders
        ADD COLUMN course_id integer UNIQUE REFERENCES courses (id) ON DELETE SET NULL
    `);
    const courses = (await queryRunner.query(
      'SELECT id, ue_id, title FROM courses ORDER BY ue_id, position',
    )) as CourseRow[];
    for (const course of courses) {
      const roots = (await queryRunner.query(
        'SELECT id, name, course_id FROM folders WHERE ue_id = $1 AND parent_id IS NULL',
        [course.ue_id],
      )) as FolderRow[];
      const name = folderName(course.title);
      const namesake = roots.find(
        (folder) =>
          folder.course_id === null &&
          folder.name.toLowerCase() === name.toLowerCase(),
      );
      if (namesake) {
        await queryRunner.query(
          'UPDATE folders SET course_id = $1 WHERE id = $2',
          [course.id, namesake.id],
        );
      } else {
        const taken = new Set(roots.map((folder) => folder.name.toLowerCase()));
        await queryRunner.query(
          'INSERT INTO folders (ue_id, name, course_id) VALUES ($1, $2, $3)',
          [course.ue_id, freeName(name, taken), course.id],
        );
      }
    }
  }

  // Les dossiers créés restent, comme dossiers ordinaires.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE folders DROP COLUMN course_id');
  }
}
