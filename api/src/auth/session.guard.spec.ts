import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionGuard } from './session.guard.js';

function createContext(userId?: number): ExecutionContext {
  return {
    getHandler: () => createContext,
    getClass: () => SessionGuard,
    switchToHttp: () => ({ getRequest: () => ({ session: { userId } }) }),
  } as unknown as ExecutionContext;
}

function createGuard(isPublic: boolean): SessionGuard {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
  return new SessionGuard(reflector);
}

describe('SessionGuard', () => {
  it('laisse passer une route publique sans session', () => {
    expect(createGuard(true).canActivate(createContext())).toBe(true);
  });

  it('laisse passer une requête avec session', () => {
    expect(createGuard(false).canActivate(createContext(1))).toBe(true);
  });

  it('refuse une requête sans session', () => {
    expect(() => createGuard(false).canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });
});
