import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { AiAccessToken } from './ai-access-token.entity.js';

const TOKEN_PREFIX = 'learn_';

export interface AiAccessStatus {
  createdAt: Date;
  lastUsedAt: Date | null;
}

// Le jeton est tiré au hasard sur 256 bits : une empreinte simple suffit, sans le
// hachage lent réservé aux mots de passe, et on le retrouve par cette empreinte.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AiAccessService {
  constructor(
    @InjectRepository(AiAccessToken)
    private readonly tokens: Repository<AiAccessToken>,
  ) {}

  // null tant qu'aucun jeton n'est en service.
  async status(): Promise<AiAccessStatus | null> {
    const [token] = await this.tokens.find({ take: 1 });
    return token
      ? { createdAt: token.createdAt, lastUsedAt: token.lastUsedAt }
      : null;
  }

  // Crée le jeton et le renvoie : c'est la seule fois où il est lisible. Le précédent,
  // s'il y en avait un, cesse aussitôt de fonctionner.
  async generate(): Promise<string> {
    const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
    await this.tokens.manager.transaction(async (manager) => {
      await manager.clear(AiAccessToken);
      await manager.insert(AiAccessToken, { tokenHash: hashToken(token) });
    });
    return token;
  }

  async revoke(): Promise<void> {
    await this.tokens.clear();
  }

  // Vrai si ce jeton est celui en service ; note alors qu'il vient de servir.
  async verify(token: string): Promise<boolean> {
    const result = await this.tokens.update(
      { tokenHash: hashToken(token) },
      { lastUsedAt: () => 'now()' },
    );
    return result.affected === 1;
  }
}
