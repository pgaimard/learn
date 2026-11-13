import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CourseOutline } from './course-outline';

describe('CourseOutline', () => {
  let fixture: ComponentFixture<CourseOutline>;

  function create(): void {
    fixture = TestBed.createComponent(CourseOutline);
    fixture.componentRef.setInput('entries', [{ index: 0, level: 2, text: '1. Notion' }]);
    fixture.detectChanges();
  }

  function toggle(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.toggle') as HTMLButtonElement;
  }

  function list(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('nav') as HTMLElement;
  }

  beforeEach(() => localStorage.clear());

  it('se rabat et se rouvre par son titre', () => {
    create();
    expect(list().hidden).toBe(false);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');

    toggle().click();
    fixture.detectChanges();
    expect(list().hidden).toBe(true);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    toggle().click();
    fixture.detectChanges();
    expect(list().hidden).toBe(false);
  });

  it('reste rabattu d’une page à l’autre', () => {
    create();
    toggle().click();

    create();
    expect(list().hidden).toBe(true);
  });
});
