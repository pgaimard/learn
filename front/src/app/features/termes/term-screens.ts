import { TermType } from './term.service';

// Dictionnaire et glossaire : deux écrans sur les mêmes termes, un par type.
export interface TermScreen {
  path: string;
  title: string;
  createLabel: string;
  emptyMessage: string;
}

export const TERM_SCREENS: Record<TermType, TermScreen> = {
  definition: {
    path: '/dictionnaire',
    title: 'Dictionnaire',
    createLabel: 'Nouvelle définition',
    emptyMessage: 'Aucune définition pour l’instant.',
  },
  acronym: {
    path: '/glossaire',
    title: 'Glossaire',
    createLabel: 'Nouvel acronyme',
    emptyMessage: 'Aucun acronyme pour l’instant.',
  },
};
