import { BadRequestException } from '@nestjs/common';

interface Identified {
  id?: number;
}

interface Named {
  name: string;
}

interface Positioned {
  id: number;
  position: number;
}

// Remplace une liste ordonnée (modes, déclinaisons d'un outil) par celle reçue. Un
// élément reçu avec un numéro met à jour celui qui le porte déjà, et garde ainsi ce qui
// s'y rattache ; sans numéro, il est nouveau ; ceux qui manquent sont retirés.
export function mergeItems<
  Item extends Positioned,
  Input extends Identified & Named,
>(
  current: Item[],
  received: Input[],
  kind: string,
  build: (existing: Item | undefined, input: Input) => Item,
): Item[] {
  const names = received.map((input) => input.name.toLocaleLowerCase('fr'));
  const duplicate = received.find(
    (_input, index) => names.indexOf(names[index]) !== index,
  );
  if (duplicate) {
    throw new BadRequestException(
      `Deux éléments de type ${kind} portent le nom « ${duplicate.name} ».`,
    );
  }
  return received.map((input, index) => {
    const existing = current.find((item) => item.id === input.id);
    if (input.id !== undefined && !existing) {
      throw new BadRequestException(
        `L’élément de type ${kind} n° ${input.id} n’appartient pas à cet outil.`,
      );
    }
    const item = build(existing, input);
    item.position = index + 1;
    return item;
  });
}
