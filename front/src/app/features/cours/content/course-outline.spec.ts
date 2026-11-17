import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OutlineEntry } from './build-outline';
import { CourseOutline } from './course-outline';

const ENTRIES: OutlineEntry[] = [
  { index: 0, level: 2, text: 'Un' },
  { index: 1, level: 2, text: 'Deux' },
  { index: 2, level: 2, text: 'Trois' },
];

@Component({
  imports: [CourseOutline],
  template: `
    <div class="scroller" style="overflow-y: auto">
      <app-course-outline [entries]="entries" [activeIndex]="active()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly entries = ENTRIES;
  readonly active = signal<number | null>(null);
}

describe('CourseOutline', () => {
  let fixture: ComponentFixture<Host>;
  let scroller: HTMLElement;

  // jsdom ne calcule pas de mise en page : le cadre du sommaire fait 100 px de haut, de
  // 0 à 100, et chaque titre 20 px, le premier à 40, le deuxième à 140, le troisième à 240.
  function layOut(): void {
    Object.defineProperty(scroller, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(scroller, 'clientHeight', { value: 100, configurable: true });
    scroller.getBoundingClientRect = () => ({ top: 0, bottom: 100, height: 100 }) as DOMRect;
    scroller.querySelectorAll('button').forEach((button, index) => {
      const top = 40 + index * 100;
      button.getBoundingClientRect = () => ({ top, bottom: top + 20, height: 20 }) as DOMRect;
    });
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    scroller = (fixture.nativeElement as HTMLElement).querySelector('.scroller') as HTMLElement;
    layOut();
  });

  function read(index: number): void {
    fixture.componentInstance.active.set(index);
    fixture.detectChanges();
  }

  it('laisse le sommaire en place tant que le titre en cours y est visible', () => {
    read(0);

    expect(scroller.scrollTop).toBe(0);
  });

  it('ramène au milieu du sommaire le titre en cours qui en est sorti', () => {
    read(2);

    // Le titre est à 240 ; au milieu d'un cadre de 100, il doit se trouver à 40.
    expect(scroller.scrollTop).toBe(200);
  });
});
