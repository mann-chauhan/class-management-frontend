import { Component } from '@angular/core';

interface SampleTestimonial {
  readonly id: string;
  readonly quote: string;
  readonly authorName: string;
  readonly authorRole: string;
  readonly institutionName: string;
  readonly initials: string;
}

@Component({
  selector: 'app-trusted-by',
  standalone: true,
  imports: [],
  templateUrl: './trusted-by.component.html',
  styleUrl: './trusted-by.component.scss',
})
export class TrustedByComponent {
  readonly testimonials: readonly SampleTestimonial[] = [
    {
      id: 'sample-review-1',
      quote:
        'CMS gives our academic team one clear place to organize student records and everyday workflows. The experience feels focused and easy to follow.',
      authorName: 'Priya Shah',
      authorRole: 'Institute Administrator',
      institutionName: 'Sunrise Learning Centre',
      initials: 'PS',
    },
    {
      id: 'sample-review-2',
      quote:
        'The structured class and teaching views help us spend less time moving between records and more time supporting our students.',
      authorName: 'Arjun Mehta',
      authorRole: 'Academic Coordinator',
      institutionName: 'Northfield Academy',
      initials: 'AM',
    },
    {
      id: 'sample-review-3',
      quote:
        'Daily information is presented in a simple, organized way. It makes routine academic work feel more manageable for our team.',
      authorName: 'Neha Verma',
      authorRole: 'Teacher',
      institutionName: 'Greenway Institute',
      initials: 'NV',
    },
  ];
}
