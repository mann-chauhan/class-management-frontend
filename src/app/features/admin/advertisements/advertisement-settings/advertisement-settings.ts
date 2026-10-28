import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdvertisementService } from '../services/advertisement.service';
import {
  AdvertisementSettings,
  AdvertisementSettingsRequest
} from '../models/advertisement.model';

@Component({
  selector: 'app-advertisement-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './advertisement-settings.html',
  styleUrl: './advertisement-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdvertisementSettingsComponent implements OnInit {
  readonly minimumRotationSeconds = 3;
  readonly maximumRotationSeconds = 60;
  readonly minimumTransitionDurationMs = 0;
  readonly maximumTransitionDurationMs = 2000;
  private readonly service = inject(AdvertisementService);
  private readonly cdr = inject(ChangeDetectorRef);

  settings: AdvertisementSettings | null = null;
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  timingValidationError = '';
  defaultRotationIntervalSeconds = 5;
  transitionDurationMs = 500;

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    if (this.saving) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.timingValidationError = '';
    this.settings = null;
    this.cdr.markForCheck();

    this.service.getSettings().subscribe({
      next: response => {
        if (!response?.data) {
          this.errorMessage = 'Advertisement settings could not be loaded.';
        } else {
          this.settings = response.data;
          this.defaultRotationIntervalSeconds = this.toSafeRotationSeconds(
            response.data.defaultRotationIntervalMs
          );
          this.transitionDurationMs = this.toSafeTransitionDuration(
            response.data.transitionDurationMs
          );
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'Could not load advertisement settings.';
        this.cdr.markForCheck();
      }
    });
  }

  saveSettings(): void {
    if (!this.settings || this.loading || this.saving) {
      return;
    }

    this.timingValidationError = this.validateTimingSettings();
    if (this.timingValidationError) {
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request: AdvertisementSettingsRequest = {
      teacherSectionEnabled: this.settings.teacherSectionEnabled,
      studentSectionEnabled: this.settings.studentSectionEnabled,
      defaultRotationIntervalMs: this.defaultRotationIntervalSeconds * 1000,
      transitionDurationMs: this.transitionDurationMs,
      version: this.settings.version
    };

    this.service.updateSettings(request).subscribe({
      next: response => {
        if (!response?.data) {
          this.errorMessage = 'Advertisement settings could not be saved.';
        } else {
          this.settings = response.data;
          this.defaultRotationIntervalSeconds = this.toSafeRotationSeconds(
            response.data.defaultRotationIntervalMs
          );
          this.transitionDurationMs = this.toSafeTransitionDuration(
            response.data.transitionDurationMs
          );
          this.successMessage = 'Advertisement settings saved successfully.';
        }
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.saving = false;
        this.errorMessage = error?.error?.message || 'Could not save advertisement settings.';
        this.cdr.markForCheck();
      }
    });
  }

  private validateTimingSettings(): string {
    if (!Number.isInteger(this.defaultRotationIntervalSeconds)
      || this.defaultRotationIntervalSeconds < this.minimumRotationSeconds
      || this.defaultRotationIntervalSeconds > this.maximumRotationSeconds) {
      return 'Default rotation interval must be a whole number from 3 to 60 seconds.';
    }
    if (!Number.isInteger(this.transitionDurationMs)
      || this.transitionDurationMs < this.minimumTransitionDurationMs
      || this.transitionDurationMs > this.maximumTransitionDurationMs
      || this.transitionDurationMs % 50 !== 0) {
      return 'Transition duration must be from 0 to 2000 milliseconds in 50 millisecond steps.';
    }
    return '';
  }

  private toSafeRotationSeconds(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(60, Math.max(3, Math.round(value / 1000)))
      : 5;
  }

  private toSafeTransitionDuration(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(2000, Math.max(0, Math.round(value / 50) * 50))
      : 500;
  }
}
