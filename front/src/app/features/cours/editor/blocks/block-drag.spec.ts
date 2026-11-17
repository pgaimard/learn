import { boundaryAt, DropCandidate, isUseful } from './block-drag';

// Trois blocs de 40 px de haut, l'un sous l'autre à partir de 100.
const BLOCKS: DropCandidate[] = [
  { pos: 0, size: 5, top: 100, bottom: 140 },
  { pos: 5, size: 8, top: 140, bottom: 180 },
  { pos: 13, size: 4, top: 180, bottom: 220 },
];

describe('boundaryAt', () => {
  it('vise la frontière avant le bloc dont le milieu est sous la souris', () => {
    expect(boundaryAt(BLOCKS, 50)).toBe(0);
    expect(boundaryAt(BLOCKS, 119)).toBe(0);
    expect(boundaryAt(BLOCKS, 121)).toBe(5);
    expect(boundaryAt(BLOCKS, 161)).toBe(13);
  });

  it('vise la fin sous le milieu du dernier bloc', () => {
    expect(boundaryAt(BLOCKS, 201)).toBe(17);
    expect(boundaryAt(BLOCKS, 900)).toBe(17);
  });

  it('ne vise rien sans bloc', () => {
    expect(boundaryAt([], 100)).toBeNull();
  });
});

describe('isUseful', () => {
  it('écarte un dépôt dans ce qui est déplacé, ou à ses bords', () => {
    const drag = { from: 5, to: 13 };

    expect(isUseful(drag, 5)).toBe(false);
    expect(isUseful(drag, 9)).toBe(false);
    expect(isUseful(drag, 13)).toBe(false);
    expect(isUseful(drag, null)).toBe(false);
    expect(isUseful(drag, 0)).toBe(true);
    expect(isUseful(drag, 17)).toBe(true);
  });
});
