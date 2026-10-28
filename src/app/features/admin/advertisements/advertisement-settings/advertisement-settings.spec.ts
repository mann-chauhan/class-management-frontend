import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AdvertisementService } from '../services/advertisement.service';
import { AdvertisementSettingsComponent } from './advertisement-settings';

describe('AdvertisementSettingsComponent', () => {
  let fixture: ComponentFixture<AdvertisementSettingsComponent>;
  let component: AdvertisementSettingsComponent;
  let service: {
    getSettings: ReturnType<typeof vi.fn>;
    updateSettings: ReturnType<typeof vi.fn>;
  };

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

    await TestBed.configureTestingModule({
      imports: [AdvertisementSettingsComponent],
      providers: [
        provideRouter([]),
        { provide: AdvertisementService, useValue: service }
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
  });
});
