import {
  ContentNode,
  EMPTY_CONTENT,
} from '../../courses/content/content-node.js';
import { validateContent } from '../../courses/content/validate-content.js';
import { markdownToContent } from '../../courses/import/markdown-to-content.js';

export interface ParsedMode {
  name: string;
  prompt: string;
  entry: string;
}

export interface ParsedOption {
  text: string;
  description: string;
  // Noms des déclinaisons où l'option existe ; aucune : toutes.
  variants: string[];
}

export interface ParsedExample {
  line: string;
  explanation: string;
  output: string;
}

export interface ParsedCommand {
  name: string;
  summary: string;
  syntax: string;
  // Nom du mode où la commande se tape ; null : aucun.
  mode: string | null;
  variants: string[];
  themes: string[];
  notes: string;
  options: ParsedOption[];
  examples: ParsedExample[];
}

export interface ParsedTool {
  name: string;
  summary: string;
  // Fiche de fonctionnement ; elle ne sert que si l'import crée l'outil.
  content: ContentNode;
  modes: ParsedMode[];
  variants: string[];
  commands: ParsedCommand[];
}

export interface ParsedCommands {
  tools: ParsedTool[];
  errors: string[];
}

const FILE = 'commandes.json';
const MAX_TOOLS = 50;
const MAX_COMMANDS = 300;
const MAX_CONTENT_LENGTH = 20_000;
const TOOL_KEYS = [
  'outil',
  'presentation',
  'fonctionnement',
  'modes',
  'declinaisons',
  'commandes',
];
const MODE_KEYS = ['nom', 'invite', 'entree'];
const COMMAND_KEYS = [
  'nom',
  'description',
  'syntaxe',
  'mode',
  'declinaisons',
  'themes',
  'notes',
  'options',
  'exemples',
];
const OPTION_KEYS = ['texte', 'description', 'declinaisons'];
const EXAMPLE_KEYS = ['ligne', 'explication', 'sortie'];

type Entry = Record<string, unknown>;

function key(name: string): string {
  return name.toLowerCase();
}

// Lit les champs d'une entrée et consigne ce qui ne va pas, en disant où.
class Reader {
  constructor(
    private readonly source: string,
    readonly errors: string[],
  ) {}

  // Lecteur d'un élément contenu dans celui-ci : « outil 2, commande 3 ».
  child(label: string): Reader {
    return new Reader(`${this.source}, ${label}`, this.errors);
  }

  fail(message: string): void {
    this.errors.push(`${this.source} : ${message}`);
  }

  // L'entrée si c'est un objet aux clés connues ; null sinon.
  entry(value: unknown, keys: string[]): Entry | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.fail('doit être un objet.');
      return null;
    }
    for (const name of Object.keys(value)) {
      if (!keys.includes(name)) {
        this.fail(`clé « ${name} » non reconnue.`);
      }
    }
    return value as Entry;
  }

  // Texte sans espaces autour ; vide s'il est absent.
  text(
    entry: Entry,
    name: string,
    maxLength: number,
    required = false,
  ): string {
    const value = entry[name];
    if (value === undefined || value === null) {
      if (required) {
        this.fail(`« ${name} » est requis.`);
      }
      return '';
    }
    if (typeof value !== 'string' || value.length > maxLength) {
      this.fail(
        `« ${name} » doit être un texte de ${maxLength} caractères au plus.`,
      );
      return '';
    }
    if (required && value.trim() === '') {
      this.fail(`« ${name} » est requis.`);
    }
    // La sortie d'un terminal garde son indentation.
    return name === 'sortie' ? value.trimEnd() : value.trim();
  }

  list(entry: Entry, name: string, maxLength: number): unknown[] {
    const value = entry[name];
    if (value === undefined || value === null) {
      return [];
    }
    if (!Array.isArray(value) || value.length > maxLength) {
      this.fail(
        `« ${name} » doit être une liste de ${maxLength} éléments au plus.`,
      );
      return [];
    }
    return value as unknown[];
  }

  // Liste de noms (déclinaisons, thèmes), sans vide ni doublon.
  names(
    entry: Entry,
    name: string,
    maxCount: number,
    maxLength: number,
  ): string[] {
    const names: string[] = [];
    for (const value of this.list(entry, name, maxCount)) {
      if (
        typeof value !== 'string' ||
        value.trim() === '' ||
        value.length > maxLength
      ) {
        this.fail(
          `« ${name} » ne contient que des textes de ${maxLength} caractères au plus.`,
        );
      } else if (!names.some((other) => key(other) === key(value.trim()))) {
        names.push(value.trim());
      }
    }
    return names;
  }

  // Signale les noms qui ne figurent pas parmi ceux que l'outil déclare.
  known(names: string[], declared: string[], kind: 'mode' | 'variant'): void {
    for (const name of names) {
      if (!declared.some((other) => key(other) === key(name))) {
        this.fail(
          kind === 'mode'
            ? `le mode « ${name} » n’est pas déclaré dans l’outil.`
            : `la déclinaison « ${name} » n’est pas déclarée dans l’outil.`,
        );
      }
    }
  }
}

function parseModes(reader: Reader, entry: Entry): ParsedMode[] {
  const modes: ParsedMode[] = [];
  reader.list(entry, 'modes', 30).forEach((value, index) => {
    const modeReader = reader.child(`mode ${index + 1}`);
    const mode = modeReader.entry(value, MODE_KEYS);
    if (!mode) {
      return;
    }
    const name = modeReader.text(mode, 'nom', 100, true);
    if (modes.some((other) => key(other.name) === key(name))) {
      modeReader.fail(`le mode « ${name} » figure deux fois.`);
    }
    modes.push({
      name,
      prompt: modeReader.text(mode, 'invite', 100),
      entry: modeReader.text(mode, 'entree', 500),
    });
  });
  return modes;
}

// La fiche d'un outil est du Markdown comme un cours, sans image.
function parseContent(reader: Reader, entry: Entry): ContentNode {
  const markdown = reader.text(entry, 'fonctionnement', MAX_CONTENT_LENGTH);
  if (markdown === '') {
    return EMPTY_CONTENT;
  }
  const converted = markdownToContent(markdown, 0, `${FILE}, fonctionnement`);
  if (converted.imagePaths.length > 0) {
    reader.fail('la fiche d’un outil ne peut pas encore contenir d’image.');
    return EMPTY_CONTENT;
  }
  const errors =
    converted.errors.length > 0
      ? converted.errors
      : validateContent(converted.document);
  errors.forEach((error) => reader.fail(error));
  return converted.document;
}

function parseOptions(
  reader: Reader,
  entry: Entry,
  variants: string[],
): ParsedOption[] {
  const options: ParsedOption[] = [];
  reader.list(entry, 'options', 100).forEach((value, index) => {
    const optionReader = reader.child(`option ${index + 1}`);
    const option = optionReader.entry(value, OPTION_KEYS);
    if (!option) {
      return;
    }
    const only = optionReader.names(option, 'declinaisons', 30, 50);
    optionReader.known(only, variants, 'variant');
    options.push({
      text: optionReader.text(option, 'texte', 200, true),
      description: optionReader.text(option, 'description', 1000),
      variants: only,
    });
  });
  return options;
}

function parseExamples(reader: Reader, entry: Entry): ParsedExample[] {
  const examples: ParsedExample[] = [];
  reader.list(entry, 'exemples', 50).forEach((value, index) => {
    const exampleReader = reader.child(`exemple ${index + 1}`);
    const example = exampleReader.entry(value, EXAMPLE_KEYS);
    if (!example) {
      return;
    }
    examples.push({
      line: exampleReader.text(example, 'ligne', 1000, true),
      explanation: exampleReader.text(example, 'explication', 1000),
      output: exampleReader.text(example, 'sortie', 10_000),
    });
  });
  return examples;
}

function parseCommand(
  reader: Reader,
  value: unknown,
  tool: Pick<ParsedTool, 'modes' | 'variants'>,
): ParsedCommand | null {
  const entry = reader.entry(value, COMMAND_KEYS);
  if (!entry) {
    return null;
  }
  const mode = reader.text(entry, 'mode', 100);
  reader.known(
    mode === '' ? [] : [mode],
    tool.modes.map((declared) => declared.name),
    'mode',
  );
  const variants = reader.names(entry, 'declinaisons', 30, 50);
  reader.known(variants, tool.variants, 'variant');
  return {
    name: reader.text(entry, 'nom', 100, true),
    summary: reader.text(entry, 'description', 300),
    syntax: reader.text(entry, 'syntaxe', 500),
    mode: mode === '' ? null : mode,
    variants,
    themes: reader.names(entry, 'themes', 10, 40),
    notes: reader.text(entry, 'notes', 5000),
    options: parseOptions(reader, entry, tool.variants),
    examples: parseExamples(reader, entry),
  };
}

function parseTool(reader: Reader, value: unknown): ParsedTool | null {
  const entry = reader.entry(value, TOOL_KEYS);
  if (!entry) {
    return null;
  }
  const tool: ParsedTool = {
    name: reader.text(entry, 'outil', 100, true),
    summary: reader.text(entry, 'presentation', 300),
    content: parseContent(reader, entry),
    modes: parseModes(reader, entry),
    variants: reader.names(entry, 'declinaisons', 30, 50),
    commands: [],
  };
  reader.list(entry, 'commandes', MAX_COMMANDS).forEach((item, index) => {
    const commandReader = reader.child(`commande ${index + 1}`);
    const command = parseCommand(commandReader, item, tool);
    if (!command) {
      return;
    }
    if (tool.commands.some((other) => key(other.name) === key(command.name))) {
      commandReader.fail(`« ${command.name} » figure deux fois dans l’outil.`);
    }
    tool.commands.push(command);
  });
  return tool;
}

function parseList(json: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as unknown[]) : null;
  } catch {
    return null;
  }
}

// Lit et vérifie un fichier commandes.json ; null quand le paquet n'en a pas.
export function parseCommands(json: string | null): ParsedCommands {
  if (json === null) {
    return { tools: [], errors: [] };
  }
  const entries = parseList(json);
  if (!entries || entries.length > MAX_TOOLS) {
    return {
      tools: [],
      errors: [
        `${FILE} doit contenir une liste de ${MAX_TOOLS} outils au plus, au format JSON.`,
      ],
    };
  }
  const tools: ParsedTool[] = [];
  const errors: string[] = [];
  entries.forEach((entry, index) => {
    const reader = new Reader(`${FILE}, outil ${index + 1}`, errors);
    const tool = parseTool(reader, entry);
    if (!tool) {
      return;
    }
    if (tools.some((other) => key(other.name) === key(tool.name))) {
      reader.fail(`l’outil « ${tool.name} » figure deux fois.`);
    }
    tools.push(tool);
  });
  return errors.length > 0 ? { tools: [], errors } : { tools, errors };
}
