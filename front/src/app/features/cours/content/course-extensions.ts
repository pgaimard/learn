import { Extensions } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { TableKit } from '@tiptap/extension-table';
import { StarterKit } from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { BlockHandle, BlockHandleOptions } from '../editor/blocks/block-handle';
import { SectionFolding } from '../editor/sections/section-folding';
import { SelectionWatcher, SelectionWatcherOptions } from '../editor/selection/selection-watcher';
import { TableTools, TableToolsOptions } from '../editor/tables/table-tools';
import { Callout } from './callout';
import { Figure } from './figure';

const lowlight = createLowlight(common);

// Blocs et marques d'un cours. Cette liste doit rester alignée sur la liste blanche
// de l'API (api/src/courses/content/content-schema.ts).
// Outils d'édition qui ouvrent un menu de l'interface.
export interface EditingTools {
  blockHandle: BlockHandleOptions;
  tableTools: TableToolsOptions;
  selection: SelectionWatcherOptions;
}

// tools : branche la poignée de bloc, les outils de tableau et la barre de sélection
// sur l'interface (édition).
export function createCourseExtensions(tools?: EditingTools): Extensions {
  return [
    StarterKit.configure({
      // Le niveau 1 est réservé au titre du cours.
      heading: { levels: [2, 3, 4, 5] },
      codeBlock: false,
      link: { openOnClick: false, protocols: ['http', 'https', 'mailto'] },
    }),
    CodeBlockLowlight.configure({ lowlight }),
    TableKit.configure({ table: { resizable: false } }),
    Figure,
    Callout,
    SectionFolding,
    ...(tools
      ? [
          BlockHandle.configure(tools.blockHandle),
          TableTools.configure(tools.tableTools),
          SelectionWatcher.configure(tools.selection),
        ]
      : []),
  ];
}
