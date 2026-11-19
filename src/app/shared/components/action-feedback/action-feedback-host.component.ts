import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject
} from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import {
  AnnouncementPriority,
  FailedFeedbackItem,
  PartialFeedbackInput,
  PartialFeedbackStatus,
  ResolvedFeedback,
  getPartialFeedbackStatus,
  getValidFailedFeedbackItems
} from '../../../core/models/action-feedback.model';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service';

@Component({
  selector: 'app-action-feedback-host',
  standalone: true,
  templateUrl: './action-feedback-host.component.html',
  styleUrl: './action-feedback-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionFeedbackHostComponent {
  private readonly feedbackService = inject(ActionFeedbackService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private announcementQueue: Array<{ id: string; message: string }> = [];
  private readonly queuedAnnouncementIds = new Set<string>();
  private announcementInProgress = false;

  readonly activeFeedback = this.feedbackService.active;

  constructor() {
    effect(() => {
      const retainedIds = new Set(this.feedbackService.retained().map(record => record.feedback.id));
      for (const id of [...this.queuedAnnouncementIds]) {
        if (!retainedIds.has(id)) this.queuedAnnouncementIds.delete(id);
      }
      this.announcementQueue = this.announcementQueue.filter(item => retainedIds.has(item.id));

      for (const record of this.feedbackService.retained()) {
        if (record.feedback.announcementPriority !== 'assertive') continue;
        if (this.queuedAnnouncementIds.has(record.feedback.id)) continue;
        this.queuedAnnouncementIds.add(record.feedback.id);
        this.announcementQueue.push({
          id: record.feedback.id,
          message: this.announcementText(record.feedback)
        });
      }
      this.processAnnouncements();
    });
  }

  dismiss(id: string): void {
    this.feedbackService.dismiss(id);
  }

  onPointerEnter(id: string): void {
    this.feedbackService.pointerEnter(id);
  }

  onPointerLeave(id: string): void {
    this.feedbackService.pointerLeave(id);
  }

  onFocusEnter(id: string): void {
    this.feedbackService.focusEnter(id);
  }

  onFocusLeave(id: string, event: FocusEvent): void {
    const currentTarget = event.currentTarget;
    const relatedTarget = event.relatedTarget;
    if (currentTarget instanceof HTMLElement && relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
      return;
    }
    this.feedbackService.focusLeave(id);
  }

  roleFor(priority: AnnouncementPriority): 'status' | 'group' {
    return priority === 'polite' ? 'status' : 'group';
  }

  liveFor(priority: AnnouncementPriority): 'polite' | 'off' {
    return priority === 'polite' ? 'polite' : 'off';
  }

  dismissLabel(title: string | undefined, kind: string): string {
    return `Dismiss ${title || `${kind} notification`}`;
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

  private announcementText(feedback: ResolvedFeedback): string {
    return [feedback.title, feedback.message, feedback.description]
      .filter((value): value is string => Boolean(value))
      .map(value => this.safeText(value, 300))
      .join('. ');
  }

  private processAnnouncements(): void {
    if (this.announcementInProgress) return;

    const next = this.announcementQueue.shift();
    if (!next) return;
    if (!this.feedbackService.retained().some(record => record.feedback.id === next.id)) {
      this.queuedAnnouncementIds.delete(next.id);
      this.processAnnouncements();
      return;
    }

    this.announcementInProgress = true;
    // LiveAnnouncer resolves after its live-region update, not after a screen reader finishes speaking.
    // Serializing these calls avoids simultaneous application-level announcements without moving focus.
    Promise.resolve()
      .then(() => this.liveAnnouncer.announce(next.message, 'assertive'))
      .then(() => {
        this.announcementInProgress = false;
        this.processAnnouncements();
      }, () => {
        this.announcementInProgress = false;
        this.processAnnouncements();
      });
  }

  private addCount(values: string[], label: string, value: number | undefined): void {
    if (value !== undefined) values.push(`${label}: ${value}`);
  }
}
