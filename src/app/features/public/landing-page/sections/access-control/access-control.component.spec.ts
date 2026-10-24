import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessControlComponent } from './access-control.component';

describe('AccessControlComponent', () => {
  let fixture: ComponentFixture<AccessControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccessControlComponent] }).compileComponents();
    fixture = TestBed.createComponent(AccessControlComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('preserves the section heading and renders the three access concepts', () => {
    const section = fixture.nativeElement.querySelector('#access-control');

    expect(section.getAttribute('aria-labelledby')).toBe('access-title');
    expect(fixture.nativeElement.querySelector('.eyebrow')?.textContent?.trim()).toBe(
      'Structured Access and Control',
    );
    expect(fixture.nativeElement.querySelector('#access-title')?.textContent?.trim()).toBe(
      'Access Shaped by Roles and Academic Scope',
    );
    expect(fixture.nativeElement.querySelector('.section-heading > p:last-child')?.textContent?.trim()).toBe(
      'Role-based routes and configured teacher permissions and assignments support distinct workflows across the system.',
    );
    const cardHeadings = fixture.nativeElement.querySelectorAll('.access-card h3') as NodeListOf<HTMLHeadingElement>;
    expect(Array.from(cardHeadings).map((heading) => heading.textContent?.trim())).toEqual([
      'Application Roles',
      'Teacher Permissions',
      'Academic Scope',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Different users. Clearly defined roles. One organized system.');
    expect(fixture.nativeElement.textContent).toContain('Control exactly what teachers can access and manage.');
    expect(fixture.nativeElement.textContent).toContain('Organized academic access across years, classes and assignments.');
  });

  it('renders the three approved illustration assets with accessible metadata', () => {
    const host = fixture.nativeElement as HTMLElement;
    const images = Array.from(host.querySelectorAll('.illustration-media img')) as HTMLImageElement[];

    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      '/assets/images/cms-application-roles.png',
      '/assets/images/cms-teacher-permissions.png',
      '/assets/images/cms-academic-scope.png',
    ]);
    expect(images.map((image) => image.getAttribute('alt'))).toEqual([
      'Role hierarchy showing Super Admin, Admin, Teacher and Student.',
      'Teacher connected to Student Management, Attendance and Exam Marks permissions.',
      'Academic structure showing Academic Year, Classes and Assignment in a connected vertical flow.',
    ]);
    expect(images.every((image) => image.loading === 'lazy')).toBe(true);
    expect(images.every((image) => image.getAttribute('width') === '1254' && image.getAttribute('height') === '1254')).toBe(true);
    expect(host.querySelector('svg')).toBeNull();
    expect(host.querySelector('.roles-hierarchy')).toBeNull();
    expect(host.querySelector('.teacher-hierarchy')).toBeNull();
    expect(host.querySelector('.scope-sequence')).toBeNull();
  });
});
