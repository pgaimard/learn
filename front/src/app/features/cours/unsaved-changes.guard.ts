import { CanDeactivateFn } from '@angular/router';

export interface LeaveAware {
  canLeave(): boolean;
}

// Demande confirmation avant de quitter une page dont les modifications ne sont pas enregistrées.
export const unsavedChangesGuard: CanDeactivateFn<LeaveAware> = (component) => component.canLeave();
