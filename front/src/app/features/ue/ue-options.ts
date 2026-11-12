import { DropdownOption } from '../../core/ui/dropdown';
import { Ue } from './ue.service';

// Options d'une liste déroulante d'UE, précédées et suivies des choix hors UE.
export function ueOptions(
  ues: Ue[],
  before: DropdownOption[] = [],
  after: DropdownOption[] = [],
): DropdownOption[] {
  return [
    ...before,
    ...ues.map((ue) => ({ value: ue.code, code: ue.code, label: ue.title })),
    ...after,
  ];
}
