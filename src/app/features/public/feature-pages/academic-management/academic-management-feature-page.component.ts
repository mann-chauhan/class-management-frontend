import { Component, signal } from '@angular/core';

import { BookDemoComponent } from '../../landing-page/sections/book-demo/book-demo.component';
import { FooterComponent } from '../../landing-page/sections/footer/footer.component';
import { NavbarComponent } from '../../landing-page/sections/navbar/navbar.component';

type AcademicPreview = 'structure' | 'students' | 'teachers';

interface PreviewTab {
  readonly id: AcademicPreview;
  readonly label: string;
}

@Component({
  selector: 'app-academic-management-feature-page',
  standalone: true,
  imports: [NavbarComponent, BookDemoComponent, FooterComponent],
  templateUrl: './academic-management-feature-page.component.html',
  styleUrl: './academic-management-feature-page.component.scss',
})
export class AcademicManagementFeaturePageComponent {
  readonly tabs: readonly PreviewTab[] = [
    { id: 'structure', label: 'Academic Structure' },
    { id: 'students', label: 'Student Records' },
    { id: 'teachers', label: 'Teacher Management' },
  ];

  readonly activePreview = signal<AcademicPreview>('structure');

  selectPreview(preview: AcademicPreview): void {
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
    const nextTab = this.tabs[nextIndex];
    this.selectPreview(nextTab.id);

    const tabList = (event.currentTarget as HTMLElement).parentElement;
    tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }
}
