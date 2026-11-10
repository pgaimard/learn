import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword } from './password-hasher.js';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOneBy({ username });
  }

  findById(id: number): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  // L'application est mono-utilisateur : le compte ne se crée qu'une fois.
  async createInitialUser(username: string, password: string): Promise<User> {
    if ((await this.users.count()) > 0) {
      throw new ConflictException('Un compte existe déjà.');
    }
    const passwordHash = await hashPassword(password);
    return this.users.save(this.users.create({ username, passwordHash }));
  }
}
