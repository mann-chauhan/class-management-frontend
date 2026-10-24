import { Component, signal } from '@angular/core';

import { BookDemoComponent } from '../../landing-page/sections/book-demo/book-demo.component';
import { FooterComponent } from '../../landing-page/sections/footer/footer.component';
import { NavbarComponent } from '../../landing-page/sections/navbar/navbar.component';

type TeachingPreview = 'attendance' | 'assignments' | 'exams';

interface PreviewTab {
  readonly id: TeachingPreview;
  readonly label: string;
}

@Component({
  selector: 'app-teaching-operations-feature-page',
  standalone: true,
  imports: [NavbarComponent, BookDemoComponent, FooterComponent],
  templateUrl: './teaching-operations-feature-page.component.html',
  styleUrl: './teaching-operations-feature-page.component.scss',
})
export class TeachingOperationsFeaturePageComponent {
  readonly tabs: readonly PreviewTab[] = [
    { id: 'attendance', label: 'Attendance' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'exams', label: 'Exams & Marks' },
  ];

  readonly activePreview = signal<TeachingPreview>('attendance');

  selectPreview(preview: TeachingPreview): void {
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
