import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CourseService } from './course.service';
import { EDITING_RENEWAL_MS, holdEditingLock } from './editing-lock';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class EditingHost {
  readonly id = input.required<number>();

  constructor() {
    holdEditingLock(this.id);
  }
}

describe('holdEditingLock', () => {
  let fixture: ComponentFixture<EditingHost>;
  const service = {
    startEditing: vi.fn<CourseService['startEditing']>(),
    releaseEditing: vi.fn<CourseService['releaseEditing']>(),
  };

  function open(id: number): void {
    TestBed.configureTestingModule({
      providers: [{ provide: CourseService, useValue: service }],
    });
    fixture = TestBed.createComponent(EditingHost);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    service.startEditing.mockReset().mockReturnValue(of(undefined));
    service.releaseEditing.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('déclare le cours en édition à l’ouverture, puis le redit tant que la page reste ouverte', () => {
    open(7);
    expect(service.startEditing).toHaveBeenCalledExactlyOnceWith(7);

    vi.advanceTimersByTime(2 * EDITING_RENEWAL_MS);

    expect(service.startEditing).toHaveBeenCalledTimes(3);
    expect(service.releaseEditing).not.toHaveBeenCalled();
  });

  it('rend le cours en quittant la page et cesse de le déclarer', () => {
    open(7);

    fixture.destroy();
    vi.advanceTimersByTime(2 * EDITING_RENEWAL_MS);

    expect(service.releaseEditing).toHaveBeenCalledExactlyOnceWith(7);
    expect(service.startEditing).toHaveBeenCalledTimes(1);
  });

  it('rend le cours quand l’onglet se ferme', () => {
    open(7);

    window.dispatchEvent(new Event('pagehide'));

    expect(service.releaseEditing).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('rend le cours quitté et prend le suivant quand la page change de cours', () => {
    open(7);

    fixture.componentRef.setInput('id', 8);
    fixture.detectChanges();

    expect(service.releaseEditing).toHaveBeenCalledExactlyOnceWith(7);
    expect(service.startEditing).toHaveBeenLastCalledWith(8);
  });

  it('laisse éditer même si la déclaration échoue', () => {
    service.startEditing.mockReturnValue(throwError(() => new Error('hors ligne')));

    expect(() => open(7)).not.toThrow();
  });
});
