import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TokenService } from '../../../../core/auth/token.service';
import { ApiService } from '../../../../core/services/api.service';
import { StudentExamService } from './student-exam.service';

describe('StudentExamService', () => {
  it('reuses the marks request within one login session', () => {
    let calls = 0;

    TestBed.configureTestingModule({
      providers: [
        StudentExamService,
        {
          provide: ApiService,
          useValue: {
            get: () => {
              calls++;
              return of({ success: true, message: 'ok', data: [] });
            }
          }
        },
        {
          provide: TokenService,
          useValue: { getPayload: () => ({ iat: 1 }) }
        }
      ]
    });

    const service = TestBed.inject(StudentExamService);
    service.getMyExams().subscribe();
    service.getMyExams().subscribe();

    expect(calls).toBe(1);
  });

  it('does not reuse one student\'s cached results for another student', () => {
    let subject = 'student-one@example.com';
    const apiGet = vi.fn(() => of({ success: true, message: 'ok', data: [] }));

    TestBed.configureTestingModule({
      providers: [
        StudentExamService,
        {
          provide: ApiService,
          useValue: {
            get: apiGet
          }
        },
        {
          provide: TokenService,
          useValue: { getPayload: () => ({ sub: subject, iat: 1 }) }
        }
      ]
    });

    const service = TestBed.inject(StudentExamService);
    service.getMyExams().subscribe();
    subject = 'student-two@example.com';
    service.getMyExams().subscribe();

    expect(apiGet).toHaveBeenCalledTimes(2);
  });
});
