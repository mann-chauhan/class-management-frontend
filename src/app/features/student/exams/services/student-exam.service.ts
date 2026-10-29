import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import {
  StudentExamApiResponse,
  StudentExamResult
} from '../models/student-exam.model';
import { TokenService } from '../../../../core/auth/token.service';

@Injectable({ providedIn: 'root' })
export class StudentExamService {
  private readonly api = inject(ApiService);
  private readonly tokenService = inject(TokenService);
  private examRequest?: Observable<StudentExamApiResponse<StudentExamResult[]>>;
  private examSessionKey: string | null = null;

  getMyExams(forceRefresh = false): Observable<StudentExamApiResponse<StudentExamResult[]>> {
    const payload = this.tokenService.getPayload();
    const sessionKey = payload ? `${payload.sub}:${payload.iat}` : null;
    if (forceRefresh || !this.examRequest || sessionKey !== this.examSessionKey) {
      this.examSessionKey = sessionKey;
      this.examRequest = this.api.get<StudentExamApiResponse<StudentExamResult[]>>(
        '/student/exams/my'
      ).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }

    return this.examRequest;
  }
}
