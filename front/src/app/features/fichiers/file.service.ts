import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface Folder {
  id: number;
  // null pour un dossier placé à la racine de l'UE.
  parentId: number | null;
  name: string;
}

export interface StoredFile {
  id: number;
  folderId: number | null;
  name: string;
  mimeType: string;
  size: number;
  updatedAt: string;
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly http = inject(HttpClient);

  listFolders(ueCode: string): Observable<Folder[]> {
    return this.http.get<Folder[]>(`${ueUrl(ueCode)}/folders`);
  }

  createFolder(ueCode: string, name: string, parentId: number | null): Observable<Folder> {
    return this.http.post<Folder>(`${ueUrl(ueCode)}/folders`, { name, parentId });
  }

  renameFolder(id: number, name: string): Observable<Folder> {
    return this.http.patch<Folder>(`/api/folders/${id}`, { name });
  }

  removeFolder(id: number): Observable<void> {
    return this.http.delete<void>(`/api/folders/${id}`);
  }

  // Fichiers d'un dossier, ou de la racine de l'UE quand folderId est null.
  listFiles(ueCode: string, folderId: number | null): Observable<StoredFile[]> {
    return this.http.get<StoredFile[]>(`${ueUrl(ueCode)}/files`, {
      params: folderId === null ? {} : { folder: folderId },
    });
  }

  upload(ueCode: string, folderId: number | null, file: File): Observable<StoredFile> {
    const form = new FormData();
    if (folderId !== null) {
      form.append('folderId', String(folderId));
    }
    form.append('file', file);
    return this.http.post<StoredFile>(`${ueUrl(ueCode)}/files`, form);
  }

  downloadUrl(id: number): string {
    return `/api/files/${id}/download`;
  }
}

function ueUrl(ueCode: string): string {
  return `/api/ues/${encodeURIComponent(ueCode)}`;
}
