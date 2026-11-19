import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { AdvertisementService } from '../services/advertisement.service';
import { AdvertisementSettingsComponent } from './advertisement-settings';

describe('AdvertisementSettingsComponent', () => {
  let fixture: ComponentFixture<AdvertisementSettingsComponent>;
  let component: AdvertisementSettingsComponent;
  let service: {
    getSettings: ReturnType<typeof vi.fn>;
    updateSettings: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      getSettings: vi.fn().mockReturnValue(of({
        data: {
          id: 1,
          teacherSectionEnabled: true,
          studentSectionEnabled: false,
          defaultRotationIntervalMs: 5000,
          transitionDurationMs: 500,
          version: 4
        }
      })),
      updateSettings: vi.fn()
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AdvertisementSettingsComponent],
      providers: [
        provideRouter([]),
        { provide: AdvertisementService, useValue: service },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdvertisementSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hydrates millisecond settings as administrator-facing seconds and preserves version', () => {
    expect(component.defaultRotationIntervalSeconds).toBe(5);
    expect(component.transitionDurationMs).toBe(500);
    expect(component.settings?.version).toBe(4);
    expect((fixture.nativeElement.querySelector('#default-rotation-interval') as HTMLInputElement).min).toBe('3');
    expect((fixture.nativeElement.querySelector('#default-rotation-interval') as HTMLInputElement).max).toBe('60');
    expect((fixture.nativeElement.querySelector('#transition-duration') as HTMLInputElement).step).toBe('50');
  });

  it('serializes seconds to milliseconds and preserves toggles and optimistic-lock version', () => {
    component.defaultRotationIntervalSeconds = 12;
    component.transitionDurationMs = 750;
    service.updateSettings.mockReturnValue(of({
      data: {
        id: 1,
        teacherSectionEnabled: true,
        studentSectionEnabled: false,
        defaultRotationIntervalMs: 12_000,
        transitionDurationMs: 750,
        version: 5
      }
    }));

    component.saveSettings();

    expect(service.updateSettings).toHaveBeenCalledWith({
      teacherSectionEnabled: true,
      studentSectionEnabled: false,
      defaultRotationIntervalMs: 12_000,
      transitionDurationMs: 750,
      version: 4
    });
    expect(component.settings?.version).toBe(5);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: expect.any(String)
    });
  });

  it('shows contextual feedback without an error toast when saving fails', () => {
    service.updateSettings.mockReturnValue(
      throwError(() => ({ error: { message: 'Version conflict' } }))
    );

    component.saveSettings();
    fixture.detectChanges();

    expect(component.saveErrorMessage).toBe('Version conflict');
    expect(feedbackService.show).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-inline-feedback')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.secondary-button')).toBeNull();
  });

  it('preserves edited values and releases the save guard after a failed save', () => {
    component.defaultRotationIntervalSeconds = 12;
    component.transitionDurationMs = 750;
    service.updateSettings.mockReturnValue(throwError(() => ({ error: { message: 'Version conflict' } })));

    component.saveSettings();

    expect(component.saving).toBe(false);
    expect(component.defaultRotationIntervalSeconds).toBe(12);
    expect(component.transitionDurationMs).toBe(750);
  });

  it('prevents duplicate saves while the first request is pending', () => {
    const pending = new Subject<unknown>();
    service.updateSettings.mockReturnValue(pending.asObservable());

    component.saveSettings();
    component.saveSettings();

    expect(service.updateSettings).toHaveBeenCalledTimes(1);
    expect(component.saving).toBe(true);
    pending.error({ error: { message: 'Temporary failure' } });
    expect(component.saving).toBe(false);
  });

  it('treats a successful response without settings data as a save failure', () => {
    service.updateSettings.mockReturnValue(of({ message: 'Saved' }));

    component.saveSettings();

    expect(component.saveErrorMessage).toBe('Advertisement settings could not be saved.');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('clears a prior save error on a later confirmed save and shows one success toast', () => {
    service.updateSettings.mockReturnValue(throwError(() => ({ error: { message: 'Failed' } })));
    component.saveSettings();
    expect(component.saveErrorMessage).toBe('Failed');

    service.updateSettings.mockReturnValue(of({
      message: 'Saved',
      data: { ...component.settings, version: 5 }
    }));
    component.saveSettings();

    expect(component.saveErrorMessage).toBe('');
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({ kind: 'success', message: 'Saved' });
  });

  it('uses safe defaults for legacy settings and blocks out-of-range values', () => {
    service.getSettings.mockReturnValue(of({
      data: {
        id: 1,
        teacherSectionEnabled: true,
        studentSectionEnabled: true,
        version: 0
      }
    }));
    component.loadSettings();
    expect(component.defaultRotationIntervalSeconds).toBe(5);
    expect(component.transitionDurationMs).toBe(500);

    component.defaultRotationIntervalSeconds = 61;
    component.saveSettings();
    expect(service.updateSettings).not.toHaveBeenCalled();
    expect(component.timingValidationError).toContain('3 to 60 seconds');
    expect(feedbackService.show).not.toHaveBeenCalled();
  });
});
