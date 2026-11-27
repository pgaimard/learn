import { Extensions } from '@tiptap/core';
import { TableKit } from '@tiptap/extension-table';
import { StarterKit } from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { BlockHandle, BlockHandleOptions } from '../editor/blocks/block-handle';
import { SectionFolding } from '../editor/sections/section-folding';
import { SelectionWatcher, SelectionWatcherOptions } from '../editor/selection/selection-watcher';
import { SlashWatcher, SlashWatcherOptions } from '../editor/slash/slash-watcher';
import { TableTools, TableToolsOptions } from '../editor/tables/table-tools';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { BookmarkMark } from '../bookmark/bookmark-mark';
import { RevisionPin } from '../revision/revision-pin';
import { Callout } from './callout';
import { CheckGrid } from './check-grid';
import { Figure } from './figure';
import { HeadingIds } from './heading-ids';
import { CourseDocument, Slide, Slideshow } from '../slideshow/slideshow';
import { Exercise, ExerciseSolution, ExerciseStatement } from '../exercise/exercise';
import { Quiz, QuizChoice, QuizExplanation, QuizPrompt, QuizQuestion } from '../quiz/quiz';
import { SectionReferences } from './section-references';
import { TermMentions } from './term-mentions';
import { TextAlign } from './text-align';

const lowlight = createLowlight(common);

// Blocs et marques d'un cours. Cette liste doit rester alignée sur la liste blanche
// de l'API (api/src/courses/content/content-schema.ts).
// Outils d'édition qui ouvrent un menu de l'interface.
export interface EditingTools {
  blockHandle: BlockHandleOptions;
  tableTools: TableToolsOptions;
  selection: SelectionWatcherOptions;
  slash: SlashWatcherOptions;
}

// tools : branche la poignée de bloc, les outils de tableau, la barre de sélection et
// le menu « / » sur l'interface (édition).
export function createCourseExtensions(tools?: EditingTools): Extensions {
  return [
    StarterKit.configure({
      // Le document accepte aussi les diaporamas et les QCM : il est défini avec eux.
      document: false,
      // Le niveau 1 est réservé au titre du cours.
      heading: { levels: [2, 3, 4, 5] },
      codeBlock: false,
      link: { openOnClick: false, protocols: ['http', 'https', 'mailto'] },
      // Emplacement d'arrivée d'un bloc ou d'une image qu'on fait glisser : une bande
      // bien visible, dessinée par la feuille de style (classe drop-slot).
      dropcursor: { color: false, width: 4, class: 'drop-slot' },
    }),
    CodeBlockLowlight.configure({ lowlight }),
    TableKit.configure({ table: { resizable: false } }),
    Figure,
    Callout,
    TextAlign,
    HeadingIds,
    CheckGrid,
    CourseDocument,
    Slideshow,
    Slide,
    Quiz,
    QuizQuestion,
    QuizPrompt,
    QuizChoice,
    QuizExplanation,
    Exercise,
    ExerciseStatement,
    ExerciseSolution,
    SectionFolding,
    SectionReferences,
    TermMentions,
    BookmarkMark,
    RevisionPin,
    ...(tools
      ? [
          BlockHandle.configure(tools.blockHandle),
          TableTools.configure(tools.tableTools),
          SelectionWatcher.configure(tools.selection),
          SlashWatcher.configure(tools.slash),
        ]
      : []),
  ];
}
