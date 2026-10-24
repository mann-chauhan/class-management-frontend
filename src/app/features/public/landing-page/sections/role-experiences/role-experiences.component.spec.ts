import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoleExperiencesComponent } from './role-experiences.component';

describe('RoleExperiencesComponent', () => {
  let fixture: ComponentFixture<RoleExperiencesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RoleExperiencesComponent] }).compileComponents();
    fixture = TestBed.createComponent(RoleExperiencesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('preserves the section copy and all three role descriptions', () => {
    const host = fixture.nativeElement as HTMLElement;
    const titles = Array.from(host.querySelectorAll('.role-copy h3'), (title: Element) =>
      title.textContent?.trim(),
    );
    const descriptions = Array.from(host.querySelectorAll('.role-copy p'), (description: Element) =>
      description.textContent?.trim(),
    );

    expect(host.querySelector('#roles')?.getAttribute('aria-labelledby')).toBe('roles-title');
    expect(host.querySelector('.eyebrow')?.textContent?.trim()).toBe('Role-Based Experiences');
    expect(host.querySelector('#roles-title')?.textContent?.trim()).toBe(
      'Relevant Workflows for Each Role',
    );
    expect(titles).toEqual(['Administrators', 'Teachers', 'Students']);
    expect(descriptions).toEqual([
      'Manage academic structure, people, fees, attendance and assessments.',
      'Work with assigned students, attendance, assignments and academic tasks.',
      'Access available attendance, fee, assignment and exam information.',
    ]);
  });

  it('renders three distinct, labeled illustrative role previews', () => {
    const host = fixture.nativeElement as HTMLElement;
    const previews = Array.from(host.querySelectorAll('.role-preview'), (preview: Element) =>
      preview.getAttribute('aria-label'),
    );

    expect(previews.length).toBe(3);
    expect(previews[0]).toContain('administrator workspace');
    expect(previews[1]).toContain('28 present and 4 absent');
    expect(previews[1]).toContain('18 out of 24');
    expect(previews[2]).toContain('student overview');
    expect(host.querySelector('.teacher-distribution')).toBeTruthy();
    expect(host.querySelector('.student-info-grid')).toBeTruthy();
    expect(host.querySelector('button, input')).toBeNull();
  });
});
