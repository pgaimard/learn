import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  CommandImportPreview,
  importCommands,
  previewCommands,
} from './command-import.js';
import { parseCommands, ParsedTool } from './parse-commands.js';

// Import d'un fichier commandes.json seul, sans paquet de cours.
@Injectable()
export class CommandImportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  preview(json: string): Promise<CommandImportPreview> {
    return previewCommands(this.dataSource.manager, read(json));
  }

  // Rend ce que l'import a trouvé avant d'écrire : ce qu'il a créé, ce qui était là.
  async import(json: string, replace: boolean): Promise<CommandImportPreview> {
    const tools = read(json);
    return this.dataSource.transaction(async (manager) => {
      const found = await previewCommands(manager, tools);
      await importCommands(manager, tools, { replace });
      return found;
    });
  }
}

function read(json: string): ParsedTool[] {
  const { tools, errors } = parseCommands(json);
  if (errors.length > 0) {
    throw new BadRequestException(errors.slice(0, 10));
  }
  return tools;
}
