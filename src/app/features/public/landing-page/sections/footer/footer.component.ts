import { Component, input } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly landingSectionPrefix = input('');

  sectionHref(sectionId: string): string {
    return `${this.landingSectionPrefix()}#${sectionId}`;
  }
}
