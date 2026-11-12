import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type EventType = 'course' | 'deadline';

export interface AgendaEvent {
  id: number;
  title: string;
  // Vide pour un événement sans description.
  description: string;
  type: EventType;
  ue: { code: string; title: string } | null;
  // Dates au format ISO 8601 ; la fin égale le début pour un événement ponctuel.
  startsAt: string;
  endsAt: string;
}

export interface Occurrence {
  startsAt: string;
  endsAt: string;
}

export interface EventDetails {
  title: string;
  description: string;
  type: EventType;
  ueCode: string | null;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);

  // Événements qui recoupent la période [from, to[.
  list(from: Date, to: Date): Observable<AgendaEvent[]> {
    return this.http.get<AgendaEvent[]>('/api/events', {
      params: { from: from.toISOString(), to: to.toISOString() },
    });
  }

  // Crée un événement indépendant par occurrence.
  create(details: EventDetails, occurrences: Occurrence[]): Observable<AgendaEvent[]> {
    return this.http.post<AgendaEvent[]>('/api/events', { ...details, occurrences });
  }

  update(id: number, changes: EventDetails & Occurrence): Observable<AgendaEvent> {
    return this.http.patch<AgendaEvent>(`/api/events/${id}`, changes);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/events/${id}`);
  }
}
