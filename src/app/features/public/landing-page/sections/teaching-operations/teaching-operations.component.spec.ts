import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TeachingOperationsComponent } from './teaching-operations.component';

describe('TeachingOperationsComponent', () => {
  let fixture: ComponentFixture<TeachingOperationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeachingOperationsComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TeachingOperationsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('preserves approved section copy and presents three illustrative academic workflows', () => {
    const host = fixture.nativeElement as HTMLElement;
    const section = host.querySelector('#teaching-operations');
    const text = host.textContent ?? '';

    expect(section).toBeTruthy();
    expect(host.querySelector('#teaching-title')?.textContent?.trim()).toBe('Support the Work Happening in Class');
    expect(host.querySelector('.eyebrow')?.textContent?.trim()).toBe('Teaching and Academic Operations');
    expect(text).toContain('Teachers and administrators can work with attendance, assignments, exams and marks.');
    expect(host.querySelector('h1')).toBeNull();

    expect(host.querySelector('.dashboard-brand h3')?.textContent?.trim()).toBe('Academic Operations');
    expect(host.querySelector('.dashboard-brand p')?.textContent?.trim()).toBe('Teaching Workspace');
    expect(host.querySelector('.period-label')?.textContent).toContain('2026\u201327');

    expect(host.querySelector('#attendance-panel-title')?.textContent?.trim()).toBe('Attendance');
    expect(text).toContain('Std. 8-A');
    expect(text).toContain('17 Oct');
    const attendanceValues = Array.from(
      host.querySelectorAll('.attendance-summary .summary-item strong'),
      (value: Element) => value.textContent?.trim(),
    );
    expect(attendanceValues).toEqual(['28', '4']);
    expect(host.querySelector('.attendance-summary')?.textContent).toContain('Present');
    expect(host.querySelector('.attendance-summary')?.textContent).toContain('Absent');
    expect(host.querySelector('.attendance-summary')?.textContent).toContain('32 students');
    expect(host.querySelector('.attendance-summary')?.textContent).not.toContain('Late');
    expect(host.querySelectorAll('.distribution-bar span').length).toBe(2);
    expect(host.querySelector('.distribution-bar')?.getAttribute('aria-label')).toBe(
      '28 present and 4 absent out of 32 students',
    );
    expect(host.querySelectorAll('.attendance-table tbody tr').length).toBe(4);
    expect(host.querySelector('.attendance-table')?.textContent).not.toContain('Late');

    expect(host.querySelector('#assignments-panel-title')?.textContent?.trim()).toBe('Assignments');
    expect(host.querySelectorAll('.assignment-item').length).toBe(3);
    expect(text).toContain('Chapter 4 Worksheet');
    expect(text).toContain('18 / 24 Submitted');
    expect(text).toContain('Science Project');
    expect(text).toContain('In Review');
    expect(host.querySelectorAll('.assignment-item [role="progressbar"]').length).toBe(3);

    expect(host.querySelector('#assessment-panel-title')?.textContent?.trim()).toBe('Exams and Marks');
    expect(text).toContain('Unit Test 2');
    expect(text).toContain('Mathematics');
    expect(host.querySelectorAll('.marks-table tbody tr').length).toBe(3);
    expect(text).toContain('42');
    expect(text).toContain('38');
    expect(text).toContain('45');
    expect(host.querySelector('.dashboard-disclosure')).toBeNull();

    expect(host.querySelector('.feature-summaries')).toBeNull();
    expect(host.querySelector('.teaching-explore-link')?.getAttribute('href')).toBe('/features/teaching-operations');
    expect(host.querySelector('.teaching-explore-link')?.textContent).toContain('Explore Teaching Operations');
    expect(host.querySelector('button, input')).toBeNull();
  });
});
