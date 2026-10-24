import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  readonly landingSectionPrefix = input('');
  readonly seamlessTransition = input(false);
  readonly menuOpen = signal(false);

  sectionHref(sectionId: string): string {
    return `${this.landingSectionPrefix()}#${sectionId}`;
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
