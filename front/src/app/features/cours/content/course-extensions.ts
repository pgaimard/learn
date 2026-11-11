import { Extensions } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { TableKit } from '@tiptap/extension-table';
import { StarterKit } from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { BlockHandle, BlockHandleOptions } from '../editor/blocks/block-handle';
import { SectionFolding } from '../editor/sections/section-folding';
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
}

// tools : branche la poignée de bloc et les outils de tableau sur l'interface (édition).
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
      ? [BlockHandle.configure(tools.blockHandle), TableTools.configure(tools.tableTools)]
      : []),
  ];
}
