import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../users/password-hasher.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AuthService {
  // Hash vérifié quand l'identifiant est inconnu : le temps de réponse ne révèle pas
  // si le compte existe.
  private readonly decoyHash = hashPassword(randomBytes(32).toString('hex'));

  constructor(private readonly usersService: UsersService) {}

  async validateCredentials(username: string, password: string): Promise<User> {
    const user = await this.usersService.findByUsername(username);
    const passwordHash = user?.passwordHash ?? (await this.decoyHash);
    const isValid = await verifyPassword(passwordHash, password);
    if (!user || !isValid) {
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');
    }
    return user;
  }

  async getCurrentUser(userId: number): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Authentification requise.');
    }
    return user;
  }

  // Redemande son mot de passe à l'utilisateur connecté, avant une action sensible. Un
  // refus n'est pas une session expirée : il ne déconnecte pas.
  async confirmPassword(userId: number, password: string): Promise<void> {
    const user = await this.getCurrentUser(userId);
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new ForbiddenException('Mot de passe incorrect.');
    }
  }
}
