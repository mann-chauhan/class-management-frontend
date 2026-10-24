import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeachingOperationsFeaturePageComponent } from './teaching-operations-feature-page.component';

describe('TeachingOperationsFeaturePageComponent', () => {
  let fixture: ComponentFixture<TeachingOperationsFeaturePageComponent>;
  let component: TeachingOperationsFeaturePageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeachingOperationsFeaturePageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TeachingOperationsFeaturePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders exactly two main feature sections and the shared page chrome', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('main > section').length).toBe(2);
    expect(host.querySelector('app-navbar')).not.toBeNull();
    expect(host.querySelector('app-book-demo')).not.toBeNull();
    expect(host.querySelector('app-footer')).not.toBeNull();
  });

  it('starts on attendance and switches all three preview tabs', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(component.activePreview()).toBe('attendance');
    expect(host.querySelector('#teaching-panel-attendance')).not.toBeNull();

    component.selectPreview('assignments');
    fixture.detectChanges();
    expect(host.querySelector('#teaching-panel-assignments')).not.toBeNull();

    component.selectPreview('exams');
    fixture.detectChanges();
    expect(host.querySelector('#teaching-panel-exams')).not.toBeNull();
  });

  it('keeps illustrative totals internally consistent', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Total Students');
    expect(host.textContent).toContain('Present');
    expect(host.textContent).toContain('Absent');
    expect(host.textContent).not.toContain('Late');

    component.selectPreview('assignments');
    fixture.detectChanges();
    expect(host.textContent).toContain('24 expected');
    expect(host.textContent).toContain('18 submitted');
    expect(host.textContent).toContain('6 pending');
  });
});
