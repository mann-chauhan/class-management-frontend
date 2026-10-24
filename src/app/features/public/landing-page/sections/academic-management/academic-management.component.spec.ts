import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AcademicManagementComponent } from './academic-management.component';

describe('AcademicManagementComponent', () => {
  let fixture: ComponentFixture<AcademicManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcademicManagementComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AcademicManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('preserves approved copy and presents verified academic, student, and teacher workflows', () => {
    const host = fixture.nativeElement as HTMLElement;
    const section = host.querySelector('#academic-management');

    expect(section).toBeTruthy();
    expect(host.querySelector('#academic-title')?.textContent?.trim()).toBe('Keep Academic Records Organized');
    expect(host.querySelector('.eyebrow')?.textContent?.trim()).toBe('Academic and Student Management');
    expect(host.textContent).toContain(
      'Manage academic years, classes, subjects, students and teachers from dedicated workflows.',
    );
    const bulkPanel = host.querySelector('.academic-panel');
    expect(bulkPanel?.querySelector('h3')?.textContent?.trim()).toBe('Student Bulk Management');
    expect(bulkPanel?.textContent).toContain('Ready to Manage Records');
    expect(bulkPanel?.textContent).toContain('Import');
    expect(bulkPanel?.textContent).toContain('Export');
    expect(bulkPanel?.textContent).toContain('Bulk Actions');
    expect(bulkPanel?.textContent).toContain('Excel Workbook');
    expect(bulkPanel?.textContent).toContain('.xlsx');
    expect(bulkPanel?.textContent).toContain('Choose Excel File');
    expect(bulkPanel?.textContent).toContain('Review records before importing');
    expect(bulkPanel?.querySelectorAll('.bulk-preview-table tbody tr').length).toBe(3);
    expect(bulkPanel?.textContent).toContain('Aarav Patel');
    expect(bulkPanel?.textContent).toContain('Mira Kapoor');
    expect(bulkPanel?.textContent).toContain('Rehan Das');
    expect(bulkPanel?.textContent).toContain('3 Sample Records');
    expect(bulkPanel?.textContent).toContain('Ready for Review');
    expect(bulkPanel?.textContent).toContain('Excel');
    expect(bulkPanel?.textContent).toContain('PDF');
    expect(bulkPanel?.textContent).toContain('2 Illustrative Records Selected');
    expect(bulkPanel?.querySelectorAll('.selected-records .inactive-status').length).toBe(2);
    expect(bulkPanel?.textContent).toContain('Delete Selected');
    expect(bulkPanel?.textContent).toContain('Delete Selected Students?');
    expect(bulkPanel?.textContent).toContain('Review the selected records before confirming deletion.');
    expect(bulkPanel?.textContent).toContain('Inactive records only');
    expect(bulkPanel?.querySelector('button, input')).toBeNull();
    expect(host.querySelector('#student-records-title')?.textContent?.trim()).toBe('Student Records');
    expect(host.textContent).toContain('Manage student information.');
    expect(host.querySelectorAll('.student-table tbody tr').length).toBe(3);
    expect(host.textContent).toContain('Nisha Kulkarni');
    expect(host.textContent).toContain('Enrollment History');
    expect(host.textContent).toContain('Inactive');
    expect(host.querySelector('#teacher-management-title')?.textContent?.trim()).toBe('Teacher Management');
    expect(host.textContent).toContain('Manage teacher information.');
    expect(host.querySelectorAll('.assignment-table tbody tr').length).toBe(3);
    expect(host.textContent).toContain('Kavita Rao');
    expect(host.textContent).toContain('Dev Malhotra');
    expect(host.textContent).toContain('Farah Khan');
    expect(host.textContent).toContain('Assigned Scope');
    expect(host.textContent).toContain('Permissions follow the assigned academic scope.');
    expect(host.textContent).not.toContain('Weekly timetable');
    expect(host.textContent).not.toContain('Teaching workload');
    expect(host.textContent).not.toContain('Attendance');
    expect(host.querySelector('.academic-explore-link')?.getAttribute('href')).toBe('/features/academic-management');
    expect(host.querySelector('.academic-explore-link')?.textContent).toContain('Explore Academic Management');
    expect(host.querySelector('h1')).toBeNull();
    expect(host.querySelector('.sample-disclosure')).toBeNull();
  });
});
