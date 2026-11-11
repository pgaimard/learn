import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, concatMap, EMPTY, Observable, Subject } from 'rxjs';
import { ApiError } from '../http/api-error';

// Enregistre des ordres successifs l'un après l'autre : deux déplacements rapprochés ne
// peuvent pas arriver au serveur dans le désordre, et le dernier demandé est le dernier
// enregistré. À créer dans le constructeur d'un composant.
export function createOrderSaver<Order>(
  save: (order: Order) => Observable<unknown>,
  onSaved: () => void,
  onError: (error: ApiError) => void,
): (order: Order) => void {
  const orders = new Subject<Order>();
  orders
    .pipe(
      concatMap((order) =>
        save(order).pipe(
          catchError((error: ApiError) => {
            onError(error);
            return EMPTY;
          }),
        ),
      ),
      takeUntilDestroyed(inject(DestroyRef)),
    )
    .subscribe(onSaved);
  return (order) => orders.next(order);
}
