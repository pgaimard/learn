import { backupStamp } from './exports.service.js';

describe('backupStamp', () => {
  it('donne l’horodatage UTC des sauvegardes, à la minute', () => {
    expect(backupStamp(new Date('2026-01-31T03:15:42.123Z'))).toBe(
      '2026-01-31T0315Z',
    );
  });
});
