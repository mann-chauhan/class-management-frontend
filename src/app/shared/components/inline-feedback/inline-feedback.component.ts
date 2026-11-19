import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import {
  AnnouncementPriority,
  FailedFeedbackItem,
  FeedbackKind,
  PartialFeedbackInput,
  PartialFeedbackStatus,
  getPartialFeedbackStatus,
  getValidFailedFeedbackItems
} from '../../../core/models/action-feedback.model';

@Component({
  selector: 'app-inline-feedback',
  standalone: true,
  templateUrl: './inline-feedback.component.html',
  styleUrl: './inline-feedback.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InlineFeedbackComponent {
  @Input({ required: true }) kind!: FeedbackKind;
  @Input({ required: true }) message!: string;
  @Input() title?: string;
  @Input() description?: string;
  @Input() dismissible = false;
  @Input() announcementPriority?: AnnouncementPriority;
  @Input() partial?: PartialFeedbackInput;

  @Output() dismissed = new EventEmitter<void>();

  get resolvedAnnouncementPriority(): AnnouncementPriority {
    return this.announcementPriority ?? 'polite';
  }

  get liveRole(): 'alert' | 'status' | 'group' {
    if (this.resolvedAnnouncementPriority === 'none') return 'group';
    return this.resolvedAnnouncementPriority === 'assertive' ? 'alert' : 'status';
  }

  get liveMode(): 'assertive' | 'polite' | 'off' {
    if (this.resolvedAnnouncementPriority === 'none') return 'off';
    return this.resolvedAnnouncementPriority;
  }

  get dismissLabel(): string {
    return `Dismiss ${this.title || `${this.kind} message`}`;
  }

  dismiss(): void {
    this.dismissed.emit();
  }

  partialSummary(partial: PartialFeedbackInput): string {
    if (this.partialStatus(partial) === 'invalid') {
      return 'Outcome details could not be confirmed.';
    }

    const values: string[] = [];
    this.addCount(values, 'Requested', partial.requested);
    this.addCount(values, 'Succeeded', partial.succeeded);
    this.addCount(values, 'Failed', partial.failed);
    this.addCount(values, 'Skipped', partial.skipped);
    this.addCount(values, 'Not attempted', partial.notAttempted);
    this.addCount(values, 'Unknown', partial.unknown);
    return values.length > 0 ? values.join(' · ') : 'Some outcomes could not be confirmed.';
  }

  partialStatus(partial: PartialFeedbackInput): PartialFeedbackStatus {
    return getPartialFeedbackStatus(partial);
  }

  partialStatusMessage(partial: PartialFeedbackInput): string | null {
    switch (this.partialStatus(partial)) {
      case 'incomplete':
        return 'The complete outcome could not be confirmed because some result details are unavailable.';
      case 'invalid':
        return 'The reported outcome was inconsistent and could not be confirmed.';
      default:
        return null;
    }
  }

  failedPreview(partial: PartialFeedbackInput): FailedFeedbackItem[] {
    return getValidFailedFeedbackItems(partial).slice(0, 5);
  }

  hasMoreFailedItems(partial: PartialFeedbackInput): boolean {
    return getValidFailedFeedbackItems(partial).length > 5;
  }

  safeText(value: string | undefined, maxLength = 180): string {
    return (value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
  }

  failedItemTrack(item: FailedFeedbackItem, index: number): string {
    return item.key !== undefined ? `key:${item.key}` : `index:${index}`;
  }

  private addCount(values: string[], label: string, value: number | undefined): void {
    if (value !== undefined) values.push(`${label}: ${value}`);
  }
}
