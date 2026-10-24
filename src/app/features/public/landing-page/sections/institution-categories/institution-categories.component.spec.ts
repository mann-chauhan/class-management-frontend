import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstitutionCategoriesComponent } from './institution-categories.component';

describe('InstitutionCategoriesComponent', () => {
  let fixture: ComponentFixture<InstitutionCategoriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [InstitutionCategoriesComponent] }).compileComponents();
    fixture = TestBed.createComponent(InstitutionCategoriesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the institution section and its three existing categories', () => {
    const section = fixture.nativeElement.querySelector('#institutions');
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.feature-card h3'), (title: Element) =>
      title.textContent?.trim(),
    );

    expect(section.getAttribute('aria-labelledby')).toBe('institutions-title');
    expect(fixture.nativeElement.querySelector('#institutions-title')?.textContent?.trim()).toBe(
      'A Connected View of Institutional Operations',
    );
    expect(titles).toEqual(['Academic Structure', 'People and Records', 'Learning Workflows']);
  });

  it('identifies the previews as illustrative sample data', () => {
    expect(fixture.nativeElement.querySelector('.sample-disclosure')?.textContent?.trim()).toBe(
      'Illustrative interfaces · Sample data',
    );
    expect(fixture.nativeElement.querySelector('.academic-illustration')?.getAttribute('aria-label')).toBe(
      'Academic structure interface preview',
    );
  });

  it('keeps the academic structure sample internally consistent', () => {
    const kpis = Array.from(
      fixture.nativeElement.querySelectorAll('.academic-kpis > div'),
      (item: HTMLElement) => [
        item.querySelector('dt')?.textContent?.trim(),
        item.querySelector('dd')?.textContent?.trim(),
      ],
    );
    const records = Array.from(
      fixture.nativeElement.querySelectorAll('.academic-records li'),
      (item: HTMLElement) => item.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(kpis).toEqual([['Classes', '3'], ['Sections', '10'], ['Subjects', '4']]);
    expect(records).toEqual(['Std. 5 4 sections', 'Std. 6 3 sections', 'Std. 7 3 sections']);
    expect(fixture.nativeElement.querySelectorAll('.subject-panel li')).toHaveLength(4);
  });

  it('shows clearly labelled fictional people records and text statuses', () => {
    const records = Array.from(
      fixture.nativeElement.querySelectorAll('.directory-row'),
      (row: HTMLElement) => ({
        name: row.querySelector('.person-copy strong')?.textContent?.trim(),
        role: row.querySelector('.person-copy small')?.textContent?.trim(),
        classOrSubject: row.querySelector('.person-class')?.textContent?.trim(),
        status: row.querySelector('.status-badge')?.textContent?.trim(),
      }),
    );

    expect(records).toEqual([
      { name: 'Aarav Patel', role: 'Student', classOrSubject: 'Std. 6-A', status: 'Active' },
      { name: 'Diya Shah', role: 'Student', classOrSubject: 'Std. 7-B', status: 'Active' },
      { name: 'Riya Mehta', role: 'Teacher', classOrSubject: 'Science', status: 'Active' },
      { name: 'Arjun Desai', role: 'Teacher', classOrSubject: 'Mathematics', status: 'Active' },
    ]);
  });

  it('matches the illustrative chart and assignment progress to their displayed values', () => {
    const columns = Array.from(fixture.nativeElement.querySelectorAll('.chart-column')) as HTMLElement[];
    const bars = columns.map((column) =>
      (column.querySelector('.chart-track i') as HTMLElement).style.getPropertyValue('--bar-height'),
    );
    const progress = fixture.nativeElement.querySelector('.progress-track') as HTMLElement;

    expect(columns.map((column) => column.querySelector('.chart-value')?.textContent?.trim())).toEqual([
      '78.4%', '84.2%', '88.6%', '92%', '89.1%', '94.6%',
    ]);
    expect(bars).toEqual(['28%', '47.3%', '62%', '73.3%', '63.7%', '82%']);
    expect(progress.getAttribute('aria-valuenow')).toBe('18');
    expect((fixture.nativeElement.querySelector('.progress-track span') as HTMLElement).style.width).toBe('75%');
  });
});
