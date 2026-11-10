import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service.js';

function createService(query: () => Promise<unknown>): HealthService {
  return new HealthService({ query } as unknown as DataSource);
}

describe('HealthService', () => {
  it('répond ok quand la base répond', async () => {
    const service = createService(() => Promise.resolve([]));

    await expect(service.check()).resolves.toEqual({ status: 'ok' });
  });

  it('signale un service indisponible quand la base ne répond pas', async () => {
    const service = createService(() => Promise.reject(new Error('refusé')));

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
