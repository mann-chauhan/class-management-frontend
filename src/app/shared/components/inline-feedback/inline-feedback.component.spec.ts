import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlineFeedbackComponent } from './inline-feedback.component';

describe('InlineFeedbackComponent', () => {
  let fixture: ComponentFixture<InlineFeedbackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InlineFeedbackComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(InlineFeedbackComponent);
    fixture.componentRef.setInput('kind', 'error');
    fixture.componentRef.setInput('message', 'The request could not be completed.');
    fixture.detectChanges();
  });

  it('renders all supported variants with their message', () => {
    for (const kind of ['success', 'info', 'warning', 'error'] as const) {
      fixture.componentRef.setInput('kind', kind);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(`.inline-feedback--${kind}`)).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.inline-feedback-message')?.textContent).toContain('request could not be completed');
    }
  });

  it('uses polite semantics by default and supports assertive and visual-only modes', () => {
    const element = fixture.nativeElement.querySelector('.inline-feedback') as HTMLElement;
    expect(element.getAttribute('role')).toBe('status');
    expect(element.getAttribute('aria-live')).toBe('polite');

    fixture.componentRef.setInput('announcementPriority', 'assertive');
    fixture.detectChanges();
    expect(element.getAttribute('role')).toBe('alert');
    expect(element.getAttribute('aria-live')).toBe('assertive');

    fixture.componentRef.setInput('announcementPriority', 'none');
    fixture.detectChanges();
    expect(element.getAttribute('role')).toBe('group');
    expect(element.getAttribute('aria-live')).toBe('off');
  });

  it('emits dismissal only when the optional control is used', () => {
    const dismissed = vi.fn();
    fixture.componentInstance.dismissed.subscribe(dismissed);
    expect(fixture.nativeElement.querySelector('.inline-feedback-dismiss')).toBeNull();

    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.inline-feedback-dismiss') as HTMLButtonElement).click();
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('renders only supplied partial counts and previews five failed items', () => {
    fixture.componentRef.setInput('partial', {
      requested: 7,
      succeeded: 2,
      failed: 6,
      failedItems: [1, 2, 3, 4, 5, 6].map(index => ({ label: `Item ${index}` }))
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.inline-feedback-partial-summary')?.textContent).toContain('Requested: 7');
    expect(fixture.nativeElement.querySelectorAll('.inline-feedback-failed-items li')).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('.inline-feedback-more-items')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.inline-feedback-partial-summary')?.textContent).not.toContain('Skipped');
    expect(fixture.nativeElement.querySelector('.inline-feedback-partial-status')?.textContent).toContain('could not be confirmed');
  });

  it('renders complete valid counts without an incomplete-result warning', () => {
    fixture.componentRef.setInput('partial', {
      requested: 3,
      succeeded: 3,
      failed: 0,
      skipped: 0,
      notAttempted: 0,
      unknown: 0
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.inline-feedback-partial-summary')?.textContent).toContain('Succeeded: 3');
    expect(fixture.nativeElement.querySelector('.inline-feedback-partial-status')).toBeNull();
  });

  it('treats missing totals and inconsistent counts as unverified', () => {
    fixture.componentRef.setInput('partial', {
      succeeded: 2,
      failed: 1
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inline-feedback-partial-status')?.textContent).toContain('could not be confirmed');

    fixture.componentRef.setInput('partial', {
      requested: 2,
      succeeded: 2,
      failed: 1,
      skipped: 0,
      notAttempted: 0,
      unknown: 0
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inline-feedback-partial-summary')?.textContent).toContain('Outcome details could not be confirmed');
    expect(fixture.nativeElement.querySelector('.inline-feedback-partial-status')?.textContent).toContain('inconsistent');
  });

  it('does not invent details for an unknown partial result', () => {
    fixture.componentRef.setInput('partial', {});
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.inline-feedback-partial-summary')?.textContent).toContain('could not be confirmed');
  });

  it('does not throw for malformed partial input and renders no invalid items', () => {
    const malformedPartials = [
      null,
      [],
      'malformed',
      { failedItems: [null, { label: '' }, { label: 'Valid-looking item', reason: 42 }] },
      { failedItems: [{ key: 'same', label: 'A' }, { key: 'same', label: 'B' }] }
    ];

    for (const partial of malformedPartials) {
      fixture.componentRef.setInput('partial', partial as never);
      expect(() => fixture.detectChanges()).not.toThrow();
      if (partial === null) {
        expect(fixture.nativeElement.querySelector('.inline-feedback-partial-summary')).toBeNull();
      } else {
        expect(fixture.nativeElement.querySelector('.inline-feedback-partial-summary')?.textContent)
          .toContain('Outcome details could not be confirmed');
      }
      expect(fixture.nativeElement.querySelectorAll('.inline-feedback-failed-items li')).toHaveLength(0);
    }
  });

  it('renders duplicate labels with safe index fallback tracking', () => {
    fixture.componentRef.setInput('partial', {
      failed: 2,
      failedItems: [{ label: 'Duplicate' }, { label: 'Duplicate' }]
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.inline-feedback-failed-items li')).toHaveLength(2);
  });
});
