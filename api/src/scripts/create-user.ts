import { NestFactory } from '@nestjs/core';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { AppModule } from '../app.module.js';
import { UsersService } from '../users/users.service.js';

const MIN_PASSWORD_LENGTH = 12;

// Sortie du terminal que l'on peut couper pendant la saisie du mot de passe.
class MutableOutput extends Writable {
  muted = false;

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: () => void,
  ): void {
    if (!this.muted) {
      process.stdout.write(chunk);
    }
    callback();
  }
}

// Les lignes sont lues par l'itérateur : il les met en file, ce qui fonctionne aussi
// quand les réponses arrivent d'un tube plutôt que d'un terminal.
async function ask(
  lines: AsyncIterator<string>,
  output: MutableOutput,
  question: string,
  hidden: boolean,
): Promise<string> {
  process.stdout.write(question);
  output.muted = hidden;
  const line = await lines.next();
  output.muted = false;
  if (hidden) {
    process.stdout.write('\n');
  }
  if (line.done) {
    throw new Error('Saisie interrompue.');
  }
  return line.value;
}

function checkCredentials(
  username: string,
  password: string,
  confirmation: string,
): void {
  if (username.length === 0) {
    throw new Error('L’identifiant est requis.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    );
  }
  if (password !== confirmation) {
    throw new Error('Les deux saisies du mot de passe diffèrent.');
  }
}

async function readCredentials(): Promise<{
  username: string;
  password: string;
}> {
  const output = new MutableOutput();
  const prompt = createInterface({
    input: process.stdin,
    output,
    terminal: process.stdin.isTTY,
  });
  const lines = prompt[Symbol.asyncIterator]();
  try {
    const username = (await ask(lines, output, 'Identifiant : ', false)).trim();
    const password = await ask(lines, output, 'Mot de passe : ', true);
    const confirmation = await ask(lines, output, 'Confirmation : ', true);
    checkCredentials(username, password, confirmation);
    return { username, password };
  } finally {
    prompt.close();
  }
}

async function main(): Promise<void> {
  const { username, password } = await readCredentials();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const user = await app
      .get(UsersService)
      .createInitialUser(username, password);
    console.log(`Compte « ${user.username} » créé.`);
  } finally {
    await app.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
