import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface MeetingMultiSelectOption {
  id: number;
  name: string;
}

@Component({
  selector: 'app-meeting-multi-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meeting-multi-select.component.html',
  styleUrl: './meeting-multi-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MeetingMultiSelectComponent), multi: true }]
})
export class MeetingMultiSelectComponent implements ControlValueAccessor, OnChanges, OnDestroy {
  private static activeInstance: MeetingMultiSelectComponent | null = null;
  private static nextId = 0;
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly panelId = `meeting-multi-select-panel-${MeetingMultiSelectComponent.nextId++}`;

  @Input({ required: true }) label = '';
  @Input() options: MeetingMultiSelectOption[] = [];
  @Input() placeholder = 'Select options';
  @Input() helperText = '';
  @Input() loading = false;
  @Input() error = '';
  @Input() locked = false;
  @Output() valueChange = new EventEmitter<number[]>();

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;

  open = false;
  search = '';
  selectedIds: number[] = [];
  controlDisabled = false;
  panelPosition: { top: number; left: number; width: number } | null = null;
  private destroyed = false;
  private onChange: (value: number[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  static dismissActiveDropdown(): boolean {
    if (!MeetingMultiSelectComponent.activeInstance?.open) return false;
    MeetingMultiSelectComponent.activeInstance.close();
    return true;
  }

  get filteredOptions(): MeetingMultiSelectOption[] {
    const term = this.search.trim().toLowerCase();
    return term ? this.options.filter(option => option.name.toLowerCase().includes(term)) : this.options;
  }

  get selectedOptions(): MeetingMultiSelectOption[] {
    return this.selectedIds
      .map(id => this.options.find(option => option.id === id))
      .filter((option): option is MeetingMultiSelectOption => !!option);
  }

  get selectedSummary(): string {
    if (!this.selectedOptions.length) return this.placeholder;
    if (this.selectedOptions.length <= 2) return this.selectedOptions.map(option => option.name).join(', ');
    return `${this.selectedOptions.length} selected`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options'] && !changes['options'].firstChange) {
      const validIds = new Set(this.options.map(option => option.id));
      const next = this.selectedIds.filter(id => validIds.has(id));
      if (next.length !== this.selectedIds.length) this.setValue(next, true);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.close();
  }

  writeValue(value: number[] | null): void {
    this.selectedIds = Array.isArray(value) ? [...new Set(value)] : [];
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: number[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.controlDisabled = isDisabled; this.cdr.markForCheck(); }

  toggle(): void {
    if (this.locked || this.controlDisabled || this.loading) return;
    if (this.open) this.close(true);
    else this.openDropdown();
  }

  private openDropdown(): void {
    MeetingMultiSelectComponent.activeInstance?.close();
    MeetingMultiSelectComponent.activeInstance = this;
    this.open = true;
    this.onTouched();
    queueMicrotask(() => {
      if (!this.destroyed && this.open) {
        this.positionPanel();
        this.searchInput?.nativeElement.focus();
      }
    });
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open) this.openDropdown();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
    } else if (event.key === 'Escape' && this.open) {
      event.preventDefault();
      this.close(true);
    }
  }

  onOptionKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      const options = (this.elementRef.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.multi-select-option');
      options[Math.max(0, Math.min(next, options.length - 1))]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = this.filteredOptions[index];
      if (option) this.toggleOption(option.id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
    }
  }

  toggleOption(id: number): void {
    if (this.locked || this.controlDisabled) return;
    const next = this.selectedIds.includes(id)
      ? this.selectedIds.filter(selectedId => selectedId !== id)
      : [...this.selectedIds, id];
    this.setValue(next);
  }

  remove(id: number, event: Event): void {
    event.stopPropagation();
    this.setValue(this.selectedIds.filter(selectedId => selectedId !== id));
  }

  clear(event?: Event): void {
    event?.stopPropagation();
    this.setValue([]);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
    }
  }

  close(restoreFocus = false): void {
    this.open = false;
    this.search = '';
    this.panelPosition = null;
    if (MeetingMultiSelectComponent.activeInstance === this) {
      MeetingMultiSelectComponent.activeInstance = null;
    }
    this.onTouched();
    if (restoreFocus) queueMicrotask(() => {
      if (!this.destroyed) this.trigger?.nativeElement.focus();
    });
    this.cdr.markForCheck();
  }

  selectAllVisible(event: Event): void {
    event.stopPropagation();
    this.setValue([...new Set([...this.selectedIds, ...this.filteredOptions.map(option => option.id)])]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open && !this.elementRef.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onDocumentKeydown(event: Event): void {
    if (!this.open) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.close(true);
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.open) this.positionPanel();
  }

  private positionPanel(): void {
    if (!this.open || !this.trigger) return;
    const triggerRect = this.trigger.nativeElement.getBoundingClientRect();
    const panel = (this.elementRef.nativeElement as HTMLElement).querySelector<HTMLElement>('.multi-select-panel');
    const viewportPadding = 12;
    const width = Math.min(Math.max(triggerRect.width, 260), window.innerWidth - (viewportPadding * 2));
    const panelHeight = panel?.offsetHeight ?? 320;
    const belowTop = triggerRect.bottom + 6;
    const top = belowTop + panelHeight <= window.innerHeight - viewportPadding
      ? belowTop
      : Math.max(viewportPadding, triggerRect.top - panelHeight - 6);
    const left = Math.min(Math.max(viewportPadding, triggerRect.left), window.innerWidth - width - viewportPadding);
    this.panelPosition = { top, left, width };
    this.cdr.markForCheck();
  }

  private setValue(value: number[], emit = true): void {
    this.selectedIds = [...new Set(value)];
    if (emit) {
      const next = [...this.selectedIds];
      this.onChange(next);
      this.valueChange.emit(next);
    }
    this.cdr.markForCheck();
  }
}
