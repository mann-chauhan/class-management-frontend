import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcademicManagementFeaturePageComponent } from './academic-management-feature-page.component';

describe('AcademicManagementFeaturePageComponent', () => {
  let fixture: ComponentFixture<AcademicManagementFeaturePageComponent>;
  let component: AcademicManagementFeaturePageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcademicManagementFeaturePageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AcademicManagementFeaturePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the two requested content sections and reuses shared public components', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-navbar')).not.toBeNull();
    expect(host.querySelector('.academic-hero')).not.toBeNull();
    expect(host.querySelector('.academic-details')).not.toBeNull();
    expect(host.querySelector('app-book-demo')).not.toBeNull();
    expect(host.querySelector('app-footer')).not.toBeNull();
    expect(host.querySelectorAll('main > section').length).toBe(2);
    expect(host.querySelector('#academic-feature-title')?.textContent?.trim()).toBe(
      'Bring Structure to Every Academic Workflow',
    );
    expect(host.querySelector('#connected-academic-title')?.textContent?.trim()).toBe(
      'One Connected Academic Workspace',
    );
  });

  it('starts on Academic Structure and switches the illustrative dashboard view', () => {
    const host = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

    expect(tabs.length).toBe(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('#academic-panel-structure')).not.toBeNull();

    tabs[1].click();
    fixture.detectChanges();

    expect(component.activePreview()).toBe('students');
    expect(host.querySelector('#academic-panel-structure')).toBeNull();
    expect(host.querySelector('#academic-panel-students')).not.toBeNull();
    expect(host.textContent).toContain('Fictional sample information');

    tabs[2].click();
    fixture.detectChanges();

    expect(component.activePreview()).toBe('teachers');
    expect(host.querySelector('#academic-panel-teachers')).not.toBeNull();
  });

  it('keeps preview data illustrative and avoids unsupported feature claims', () => {
    const host = fixture.nativeElement as HTMLElement;
    const heroPreview = host.querySelector('.hero-dashboard');

    expect(heroPreview?.textContent).not.toContain('Illustrative Academic Management Preview');
    expect(heroPreview?.getAttribute('aria-label')).toContain('Illustrative Academic Management dashboard');
    expect(host.textContent).not.toContain('Illustrative Academic Management Preview');
    expect(host.textContent).not.toContain('Payroll');
    expect(host.textContent).not.toContain('Timetable');
    expect(host.textContent).not.toContain('Attendance analytics');
  });
});
