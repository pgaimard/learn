import { spawn } from 'node:child_process';

// Lance une commande sans passer par un shell et attend sa fin ; échoue si elle sort en
// erreur. Sa sortie d'erreur accompagne l'échec, pour le journal de l'API.
export function run(
  command: string,
  args: string[],
  environment: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let output = '';
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} a échoué (code ${code}) : ${output}`));
      }
    });
  });
}
