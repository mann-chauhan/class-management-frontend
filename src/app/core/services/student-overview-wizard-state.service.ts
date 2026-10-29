import { Injectable } from '@angular/core';

import { TokenService } from '../auth/token.service';

export type StudentOverviewWizardStep = 'attendance' | 'marks' | 'completed';

@Injectable({ providedIn: 'root' })
export class StudentOverviewWizardStateService {
  private readonly storagePrefix = 'cms.student-overview-wizard.';
  private readonly sessionMarkerKey = 'cms.student-overview-wizard-session';

  constructor(private readonly tokenService: TokenService) {}

  isRequiredFor(role: string | null): boolean {
    return role === 'STUDENT' && this.getStep() !== 'completed';
  }

  getStep(): StudentOverviewWizardStep {
    const key = this.storageKey();
    if (!key) return 'attendance';

    const stored = sessionStorage.getItem(key);
    return stored === 'marks' || stored === 'completed' ? stored : 'attendance';
  }

  setStep(step: Exclude<StudentOverviewWizardStep, 'completed'>): void {
    const key = this.storageKey();
    if (key) sessionStorage.setItem(key, step);
  }

  complete(): void {
    const key = this.storageKey();
    if (key) sessionStorage.setItem(key, 'completed');
  }

  clear(): void {
    const key = this.storageKey();
    if (key) sessionStorage.removeItem(key);
    sessionStorage.removeItem(this.sessionMarkerKey);
  }

  private storageKey(): string | null {
    const payload = this.tokenService.getPayload();
    if (!payload?.sub || !payload.iat) return null;

    const studentKey = encodeURIComponent(payload.sub);
    let sessionMarker = sessionStorage.getItem(this.sessionMarkerKey);
    if (!sessionMarker || !sessionMarker.startsWith(`${studentKey}.`)) {
      sessionMarker = `${studentKey}.${payload.iat}`;
      sessionStorage.setItem(this.sessionMarkerKey, sessionMarker);
    }

    return `${this.storagePrefix}${sessionMarker}`;
  }
}
