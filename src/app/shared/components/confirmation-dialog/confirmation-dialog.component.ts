import { A11yModule } from '@angular/cdk/a11y';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, Renderer2, ViewChild, inject } from '@angular/core';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [A11yModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent implements AfterViewInit, OnDestroy {

  private static nextId = 0;
  private readonly renderer = inject(Renderer2);
  private removeEscapeListener?: () => void;
  private previouslyFocused: HTMLElement | null = null;
  private viewReady = false;
  private _visible = false;

  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;

  readonly titleId = `confirmation-title-${++ConfirmationDialogComponent.nextId}`;
  readonly messageId = `confirmation-message-${ConfirmationDialogComponent.nextId}`;

  @Input() get visible(): boolean { return this._visible; }
  set visible(value: boolean) {
    if (this._visible === value) return;
    this._visible = value;
    if (value) this.open(); else this.close();
  }

  @Input() title = 'Confirm Action';

  @Input() message =
    'Are you sure you want to continue? This action cannot be undone.';

  @Input() confirmLabel = 'Confirm';

  @Input() cancelLabel = 'Cancel';

  @Input() danger = true;

  @Input() busy = false;

  @Input() busyLabel = 'Processing...';

  @Output() confirmed = new EventEmitter<void>();

  @Output() cancelled = new EventEmitter<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onOverlayClick(): void {
    this.cancelled.emit();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.visible) this.focusDialog();
  }

  ngOnDestroy(): void {
    this.removeEscapeListener?.();
  }

  private open(): void {
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.removeEscapeListener?.();
    this.removeEscapeListener = this.renderer.listen('document', 'keydown', (event: KeyboardEvent) => {
      if (!this.visible || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.onCancel();
    });
    if (this.viewReady) this.focusDialog();
  }

  private close(): void {
    this.removeEscapeListener?.();
    this.removeEscapeListener = undefined;
    const target = this.previouslyFocused;
    this.previouslyFocused = null;
    if (target && target.isConnected && !target.hasAttribute('disabled')) {
      queueMicrotask(() => target.focus());
    }
  }

  private focusDialog(): void {
    queueMicrotask(() => this.dialog?.nativeElement.focus());
  }
}
