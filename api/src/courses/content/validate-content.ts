import { ContentNode } from './content-node.js';
import {
  BLOCK_TYPES,
  INLINE_TYPES,
  MARK_RULES,
  NODE_RULES,
  NodeRule,
} from './content-schema.js';

const MAX_DEPTH = 30;
const MAX_NODES = 50000;
const MAX_ERRORS = 10;

type AttributeChecks = Record<string, (value: unknown) => boolean>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function allowedChildren(rule: NodeRule): readonly string[] {
  switch (rule.children) {
    case 'none':
      return [];
    case 'text':
      return ['text'];
    case 'inline':
      return INLINE_TYPES;
    case 'block':
      return BLOCK_TYPES;
    default:
      return rule.children;
  }
}

class ContentValidator {
  readonly errors = new Set<string>();
  private nodeCount = 0;

  checkDocument(value: unknown): void {
    if (!isRecord(value) || value['type'] !== 'doc') {
      this.errors.add('Le contenu doit être un document de l’éditeur.');
      return;
    }
    this.checkNode(value, 0);
  }

  private checkNode(node: Record<string, unknown>, depth: number): void {
    this.nodeCount += 1;
    if (depth > MAX_DEPTH || this.nodeCount > MAX_NODES) {
      this.errors.add('Le contenu est trop volumineux ou trop imbriqué.');
      return;
    }
    const type = String(node['type']);
    if (type === 'text') {
      this.checkText(node);
      return;
    }
    const rule = NODE_RULES[type];
    this.checkKeys(node, ['type', 'attrs', 'content'], type);
    this.checkAttributes(node['attrs'], rule.attrs ?? {}, type);
    this.checkChildren(node['content'], rule, type, depth);
  }

  private checkChildren(
    content: unknown,
    rule: NodeRule,
    type: string,
    depth: number,
  ): void {
    const children = content === undefined ? [] : content;
    if (!Array.isArray(children)) {
      this.errors.add(`Le contenu du bloc « ${type} » est mal formé.`);
      return;
    }
    if (children.length < (rule.minChildren ?? 0)) {
      this.errors.add(`Le bloc « ${type} » ne peut pas être vide.`);
    }
    const allowed = allowedChildren(rule);
    for (const child of children as unknown[]) {
      if (this.errors.size >= MAX_ERRORS) {
        return;
      }
      if (!isRecord(child) || typeof child['type'] !== 'string') {
        this.errors.add(`Le contenu du bloc « ${type} » est mal formé.`);
      } else if (!(child['type'] in NODE_RULES) && child['type'] !== 'text') {
        this.errors.add(`Bloc non autorisé : « ${child['type']} ».`);
      } else if (!allowed.includes(child['type'])) {
        this.errors.add(
          `Le bloc « ${child['type']} » n’est pas autorisé dans « ${type} ».`,
        );
      } else {
        this.checkNode(child, depth + 1);
      }
    }
  }

  private checkText(node: Record<string, unknown>): void {
    this.checkKeys(node, ['type', 'text', 'marks'], 'text');
    if (typeof node['text'] !== 'string' || node['text'].length === 0) {
      this.errors.add('Un texte du contenu est vide ou mal formé.');
    }
    const marks = node['marks'] === undefined ? [] : node['marks'];
    if (!Array.isArray(marks)) {
      this.errors.add('Les marques d’un texte sont mal formées.');
      return;
    }
    for (const mark of marks as unknown[]) {
      this.checkMark(mark);
    }
  }

  private checkMark(mark: unknown): void {
    if (!isRecord(mark) || typeof mark['type'] !== 'string') {
      this.errors.add('Les marques d’un texte sont mal formées.');
      return;
    }
    if (!(mark['type'] in MARK_RULES)) {
      this.errors.add(`Marque non autorisée : « ${mark['type']} ».`);
      return;
    }
    this.checkKeys(mark, ['type', 'attrs'], mark['type']);
    this.checkAttributes(mark['attrs'], MARK_RULES[mark['type']], mark['type']);
  }

  private checkKeys(
    value: Record<string, unknown>,
    allowed: string[],
    type: string,
  ): void {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        this.errors.add(
          `Propriété non autorisée sur « ${type} » : « ${key} ».`,
        );
      }
    }
  }

  private checkAttributes(
    attrs: unknown,
    checks: AttributeChecks,
    type: string,
  ): void {
    if (attrs === undefined) {
      return;
    }
    if (!isRecord(attrs)) {
      this.errors.add(`Les attributs de « ${type} » sont mal formés.`);
      return;
    }
    for (const [name, value] of Object.entries(attrs)) {
      if (!(name in checks)) {
        this.errors.add(`Attribut non autorisé sur « ${type} » : « ${name} ».`);
      } else if (!checks[name](value)) {
        this.errors.add(
          `Valeur non autorisée pour « ${name} » sur « ${type} ».`,
        );
      }
    }
  }
}

// Renvoie les erreurs trouvées ; une liste vide signifie que le contenu est accepté.
export function validateContent(value: unknown): string[] {
  const validator = new ContentValidator();
  validator.checkDocument(value);
  return [...validator.errors].slice(0, MAX_ERRORS);
}

export function isContentNode(value: unknown): value is ContentNode {
  return validateContent(value).length === 0;
}
