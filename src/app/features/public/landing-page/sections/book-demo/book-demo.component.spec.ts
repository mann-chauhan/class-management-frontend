import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookDemoComponent } from './book-demo.component';

describe('BookDemoComponent', () => {
  let fixture: ComponentFixture<BookDemoComponent>;
  let component: BookDemoComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BookDemoComponent] }).compileComponents();
    fixture = TestBed.createComponent(BookDemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the approved demo heading and accessible enquiry fields', () => {
    const section = fixture.nativeElement.querySelector('#book-a-demo');
    const host = fixture.nativeElement as HTMLElement;

    expect(section.getAttribute('aria-labelledby')).toBe('demo-title');
    expect(host.querySelector('.eyebrow')?.textContent?.trim()).toBe('Book a Demo');
    expect(host.querySelector('#demo-title')?.textContent?.trim()).toBe(
      'See How CMS Brings Academic Workflows Together',
    );
    expect(host.querySelector('label[for="demo-name"]')?.textContent?.trim()).toBe('Your Name');
    expect(host.querySelector('label[for="demo-institute"]')?.textContent?.trim()).toBe('Institute Name');
    expect(host.querySelector('label[for="demo-designation"]')?.textContent?.trim()).toBe('Designation');
    expect(host.querySelector('#demo-name')?.getAttribute('placeholder')).toBe('Enter your name');
    expect(host.querySelector('#demo-institute')?.getAttribute('placeholder')).toBe('Enter institute name');
    expect(host.querySelector('#demo-designation option[value=""]')?.textContent?.trim()).toBe('Select designation');
    expect(Array.from(host.querySelectorAll('#demo-designation option')).map((option) => option.textContent?.trim())).toEqual([
      'Select designation',
      'Admin',
      'Owner',
    ]);
    expect(host.querySelector('.request-button')?.textContent).toContain('Request Demo');
  });

  it('validates required details and does not claim a request was sent without a contact channel', () => {
    component.requestDemo();
    fixture.detectChanges();

    expect(component.demoForm.invalid).toBe(true);
    expect(component.demoForm.controls.name.touched).toBe(true);
    expect(component.submissionNotice).toBe('');

    component.demoForm.setValue({ name: 'Asha Rao', instituteName: 'North School', designation: 'Admin' });
    component.requestDemo();

    expect(component.submissionNotice).toContain('Your details were not sent');
    expect(component.submissionNotice).toContain('not configured yet');
  });
});
