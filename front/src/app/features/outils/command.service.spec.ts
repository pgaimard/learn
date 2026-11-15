import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CommandInput, CommandService } from './command.service';

const INPUT: CommandInput = {
  name: 'ping',
  summary: '',
  syntax: '',
  modeId: null,
  variantIds: [],
  notes: '',
  themes: [],
  ueCodes: [],
  courseIds: [],
  options: [],
  examples: [],
};

describe('CommandService', () => {
  let service: CommandService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommandService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('range les commandes sous leur outil', () => {
    service.list(3).subscribe();
    service.listByUe('UTC502').subscribe();
    service.listByCourse(7).subscribe();
    service.create(3, INPUT).subscribe();
    service.update(3, 8, INPUT).subscribe();
    service.remove(3, 8).subscribe();

    const calls = http.match(() => true);
    expect(calls.map(({ request }) => `${request.method} ${request.url}`)).toEqual([
      'GET /api/tools/3/commands',
      'GET /api/ues/UTC502/commands',
      'GET /api/courses/7/commands',
      'POST /api/tools/3/commands',
      'PATCH /api/tools/3/commands/8',
      'DELETE /api/tools/3/commands/8',
    ]);
  });
});
