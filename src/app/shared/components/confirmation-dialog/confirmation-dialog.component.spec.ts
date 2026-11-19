import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';

describe('ConfirmationDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmationDialogComponent>;
  let component: ConfirmationDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmationDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(ConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates hidden by default', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders unique title and message associations when visible', async () => {
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-labelledby')).toBe(component.titleId);
    expect(dialog.getAttribute('aria-describedby')).toBe(component.messageId);
    expect(fixture.nativeElement.querySelector(`#${component.titleId}`)).toBeTruthy();
    expect(fixture.nativeElement.querySelector(`#${component.messageId}`)).toBeTruthy();
  });

  it('emits confirmation, cancellation, and backdrop cancellation', async () => {
    const confirmed = vi.fn();
    const cancelled = vi.fn();
    component.confirmed.subscribe(confirmed);
    component.cancelled.subscribe(cancelled);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.confirm-button').click();
    fixture.nativeElement.querySelector('.cancel-button').click();
    fixture.nativeElement.querySelector('.dialog-overlay').click();
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledTimes(2);
  });

  it('does not cancel on Escape while hidden and cancels once while visible', () => {
    const cancelled = vi.fn();
    component.cancelled.subscribe(cancelled);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).not.toHaveBeenCalled();
    component.visible = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('keeps clicks inside the dialog from cancelling', async () => {
    const cancelled = vi.fn();
    component.cancelled.subscribe(cancelled);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.debugElement.query(By.css('.confirmation-dialog')).triggerEventHandler('click', { stopPropagation: vi.fn() });
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('restores focus after closing', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', false);
    await fixture.whenStable();
    await Promise.resolve();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('supports normal and danger variants', async () => {
    fixture.componentRef.setInput('danger', false);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.confirm-button-normal')).toBeTruthy();
    fixture.componentRef.setInput('danger', true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dialog-icon-danger')).toBeTruthy();
  });

  it('disables both actions and shows the busy label while processing', async () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('busy', true);
    fixture.componentRef.setInput('busyLabel', 'Saving...');
    await fixture.whenStable();
    fixture.detectChanges();
    const confirm = fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement;
    const cancel = fixture.nativeElement.querySelector('.cancel-button') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(cancel.disabled).toBe(true);
    expect(cancel.textContent).toContain('Saving...');
  });

  it('restores normal actions when busy processing is released', async () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('busy', true);
    fixture.componentRef.setInput('busyLabel', 'Saving...');
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentRef.setInput('busy', false);
    await fixture.whenStable();
    fixture.detectChanges();

    const confirm = fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement;
    const cancel = fixture.nativeElement.querySelector('.cancel-button') as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    expect(cancel.disabled).toBe(false);
    expect(cancel.textContent).toContain(component.cancelLabel);
  });
});
