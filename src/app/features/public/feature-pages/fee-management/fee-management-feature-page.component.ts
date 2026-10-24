import { Component, signal } from '@angular/core';

import { BookDemoComponent } from '../../landing-page/sections/book-demo/book-demo.component';
import { FooterComponent } from '../../landing-page/sections/footer/footer.component';
import { NavbarComponent } from '../../landing-page/sections/navbar/navbar.component';

type FeePreview = 'structures' | 'records' | 'payments';

interface PreviewTab {
  readonly id: FeePreview;
  readonly label: string;
}

@Component({
  selector: 'app-fee-management-feature-page',
  standalone: true,
  imports: [NavbarComponent, BookDemoComponent, FooterComponent],
  templateUrl: './fee-management-feature-page.component.html',
  styleUrl: './fee-management-feature-page.component.scss',
})
export class FeeManagementFeaturePageComponent {
  readonly tabs: readonly PreviewTab[] = [
    { id: 'structures', label: 'Fee Structures' },
    { id: 'records', label: 'Student Fee Records' },
    { id: 'payments', label: 'Payments & Receipts' },
  ];

  readonly activePreview = signal<FeePreview>('structures');

  selectPreview(preview: FeePreview): void {
    this.activePreview.set(preview);
  }

  handleTabKeydown(event: KeyboardEvent, currentIndex: number): void {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % this.tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = this.tabs.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    this.selectPreview(this.tabs[nextIndex].id);

    const tabList = (event.currentTarget as HTMLElement).parentElement;
    tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }
}
