import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import {
  CreateStudentSchoolPerformanceRequest,
  UpdateStudentSchoolPerformanceRequest
} from '../models/student-school-performance.model';
import { StudentSchoolPerformanceService } from './student-school-performance.service';

describe('StudentSchoolPerformanceService', () => {
  let api: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: StudentSchoolPerformanceService;

  beforeEach(() => {
    api = {
      get: vi.fn(() => of({})),
      post: vi.fn(() => of({})),
      put: vi.fn(() => of({})),
      delete: vi.fn(() => of({}))
    };

    TestBed.configureTestingModule({
      providers: [
        StudentSchoolPerformanceService,
        { provide: ApiService, useValue: api }
      ]
    });

    service = TestBed.inject(StudentSchoolPerformanceService);
  });

  it('lists records with the backend page parameters', () => {
    service.list(12, 2, 20).subscribe();

    const params = api.get.mock.calls[0][1];
    expect(api.get.mock.calls[0][0]).toBe('/students/12/school-performance');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('20');
    expect(params.has('sortBy')).toBe(false);
    expect(params.has('sortDirection')).toBe(false);
  });

  it('adds only the supported search, school, and sort parameters', () => {
    service.list(12, 0, 20, {
      search: '  Final Exam ',
      schoolId: 4,
      sortBy: 'schoolName',
      sortDirection: 'asc'
    }).subscribe();

    const params = api.get.mock.calls[0][1];
    expect(params.get('search')).toBe('Final Exam');
    expect(params.get('schoolId')).toBe('4');
    expect(params.get('sortBy')).toBe('schoolName');
    expect(params.get('sortDirection')).toBe('asc');
  });

  it('does not send empty optional filters', () => {
    service.list(12, 0, 20, {
      search: '   ',
      schoolId: null,
      sortBy: undefined,
      sortDirection: undefined
    }).subscribe();

    const params = api.get.mock.calls[0][1];
    expect(params.has('search')).toBe(false);
    expect(params.has('schoolId')).toBe(false);
    expect(params.has('sortBy')).toBe(false);
    expect(params.has('sortDirection')).toBe(false);
  });

  it('loads the summary endpoint without inventing query parameters', () => {
    service.summary(12).subscribe();

    expect(api.get).toHaveBeenCalledWith(
      '/students/12/school-performance/summary'
    );
  });

  it('uses the exact create, update, and delete contracts', () => {
    const createRequest: CreateStudentSchoolPerformanceRequest = {
      schoolId: 4,
      examName: 'Final Exam',
      examDate: null,
      maximumMarks: 100,
      obtainedMarks: 75
    };
    const updateRequest: UpdateStudentSchoolPerformanceRequest = {
      ...createRequest,
      version: 3
    };

    service.create(12, createRequest).subscribe();
    service.update(12, 8, updateRequest).subscribe();
    service.delete(12, 8).subscribe();

    expect(api.post).toHaveBeenCalledWith(
      '/students/12/school-performance',
      createRequest
    );
    expect(api.put).toHaveBeenCalledWith(
      '/students/12/school-performance/8',
      updateRequest
    );
    expect(api.delete).toHaveBeenCalledWith(
      '/students/12/school-performance/8'
    );
  });
});
