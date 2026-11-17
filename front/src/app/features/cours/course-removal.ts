import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { CourseFolder, CourseService } from './course.service';

// Suppression d'un cours, depuis n'importe quelle page : la confirmation, puis le sort de
// son dossier de fichiers quand il n'est pas vide.
@Injectable({ providedIn: 'root' })
export class CourseRemoval {
  private readonly courseService = inject(CourseService);
  private readonly dialog = inject(DialogService);

  // Résout à true si le cours a été supprimé, à false si l'utilisateur a renoncé.
  // Un refus de l'API est rejeté, comme pour tout appel.
  async remove(course: { id: number; title: string }): Promise<boolean> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer le cours',
      `Le cours « ${course.title} » et ses images seront supprimés définitivement.`,
    );
    if (!confirmed) {
      return false;
    }
    const folder = await firstValueFrom(this.courseService.folder(course.id));
    const deleteFolder = folder !== null && hasContent(folder) && (await this.askFolder(folder));
    await firstValueFrom(this.courseService.remove(course.id, deleteFolder));
    return true;
  }

  private askFolder(folder: CourseFolder): Promise<boolean> {
    return this.dialog.confirm({
      title: 'Dossier de fichiers du cours',
      message: `Le dossier « ${folder.name} » contient ${contentOf(folder)}. Le supprimer aussi, avec tout son contenu ? Sinon il reste dans les fichiers de l’UE.`,
      confirmLabel: 'Supprimer le dossier',
      cancelLabel: 'Garder le dossier',
      isDestructive: true,
    });
  }
}

function hasContent(folder: CourseFolder): boolean {
  return folder.fileCount + folder.folderCount > 0;
}

function contentOf(folder: CourseFolder): string {
  const files = `${folder.fileCount} fichier(s)`;
  return folder.folderCount > 0 ? `${files} et ${folder.folderCount} sous-dossier(s)` : files;
}
