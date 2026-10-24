import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeroComponent } from './hero.component';

describe('HeroComponent', () => {
  let fixture: ComponentFixture<HeroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should render the approved headline and supporting copy', () => {
    const heading = fixture.nativeElement.querySelector('h1') as HTMLHeadingElement;
    const description = fixture.nativeElement.querySelector('.hero-description') as HTMLParagraphElement;

    expect(heading.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Everything Your Institution Needs. All in One Place.',
    );
    expect(description.textContent?.trim()).toBe(
      'Manage academics, students, teachers, attendance, fees and examinations through one connected platform.',
    );
  });

  it('should preserve the feature and login CTA destinations', () => {
    const featureCta = fixture.nativeElement.querySelector('.button-primary') as HTMLAnchorElement;
    const loginCta = fixture.nativeElement.querySelector('.button-secondary') as HTMLAnchorElement;

    expect(featureCta.textContent?.trim()).toBe('Explore Features');
    expect(featureCta.getAttribute('href')).toBe('#academic-management');
    expect(loginCta.textContent?.trim()).toBe('Sign In');
    expect(loginCta.getAttribute('href')).toBe('/login');
  });

  it('should identify the dashboard as illustrative and its values as samples', () => {
    const preview = fixture.nativeElement.querySelector('.product-preview') as HTMLDivElement;
    const caption = fixture.nativeElement.querySelector('.preview-caption') as HTMLParagraphElement;

    expect(preview.getAttribute('role')).toBe('group');
    expect(preview.getAttribute('aria-label')).toBe('Illustrative CMS dashboard with sample data');
    expect(caption.textContent?.trim()).toBe('Illustrative product preview');
    expect(fixture.nativeElement.querySelector('.sample-disclosure')?.textContent?.trim()).toBe('Sample Data');
  });

  it('should render the four sample dashboard metrics', () => {
    const metrics = Array.from(
      fixture.nativeElement.querySelectorAll('.summary-card'),
      (card: HTMLElement) => ({
        label: card.querySelector('.metric-label')?.textContent?.trim(),
        value: card.querySelector('.metric-value')?.textContent?.trim(),
      }),
    );

    expect(metrics).toEqual([
      { label: 'Students', value: '1,248' },
      { label: 'Teachers', value: '68' },
      { label: 'Attendance Today', value: '94.6%' },
      { label: 'Fee Collection', value: '₹8.4L' },
    ]);
  });

  it('should derive six attendance bar heights from their labelled sample values', () => {
    const chart = fixture.nativeElement.querySelector('.chart-plot') as HTMLDivElement;
    const columns = Array.from(fixture.nativeElement.querySelectorAll('.chart-column')) as HTMLDivElement[];

    expect(columns.map((column) => column.querySelector('.chart-period')?.textContent?.trim())).toEqual([
      'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
    ]);
    expect(chart.getAttribute('aria-label')).toContain('Illustrative sample attendance values');
    expect(columns).toHaveLength(6);

    columns.forEach((column) => {
      const value = Number.parseFloat(column.querySelector('.chart-value')?.textContent ?? '0');
      const barHeight = Number.parseFloat((column.querySelector('.chart-bar') as HTMLElement).style.height);

      expect(barHeight).toBeCloseTo(((value - 70) / 30) * 100, 5);
      expect(barHeight).toBeGreaterThanOrEqual(0);
      expect(barHeight).toBeLessThanOrEqual(100);
    });
  });

  it('should mark the recent activity rows as illustrative examples', () => {
    const activities = Array.from(
      fixture.nativeElement.querySelectorAll('.activity-row'),
      (row: HTMLElement) => row.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(activities).toHaveLength(3);
    expect(activities.every((activity) => activity?.includes('Example'))).toBe(true);
  });

  it('should show the requested platform-area highlights', () => {
    const benefits = Array.from(
      fixture.nativeElement.querySelectorAll('.benefit-list li'),
      (item: HTMLLIElement) => item.textContent?.trim(),
    );

    expect(benefits).toEqual(['Academic Management', 'Student Records', 'Fee Tracking']);
  });

  it('should illustrate the existing CMS areas and dashboard panels', () => {
    const dashboard = fixture.nativeElement.querySelector('.dashboard-sidebar') as HTMLDivElement;
    const labels = dashboard.textContent?.replace(/\s+/g, ' ').trim();

    expect(labels).toContain('Dashboard Academics Students Teachers Attendance Fees Examinations');
    expect(fixture.nativeElement.querySelector('.attendance-panel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.activity-panel')).toBeTruthy();
  });
});
