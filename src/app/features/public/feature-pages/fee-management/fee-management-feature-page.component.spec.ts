import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeManagementFeaturePageComponent } from './fee-management-feature-page.component';

describe('FeeManagementFeaturePageComponent', () => {
  let fixture: ComponentFixture<FeeManagementFeaturePageComponent>;
  let component: FeeManagementFeaturePageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeManagementFeaturePageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FeeManagementFeaturePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders exactly two main feature sections and shared page components', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('main > section').length).toBe(2);
    expect(host.querySelector('app-navbar')).not.toBeNull();
    expect(host.querySelector('app-book-demo')).not.toBeNull();
    expect(host.querySelector('app-footer')).not.toBeNull();
  });

  it('starts on fee structures and switches all three preview tabs', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(component.activePreview()).toBe('structures');
    expect(host.querySelector('#fee-panel-structures')).not.toBeNull();

    component.selectPreview('records');
    fixture.detectChanges();
    expect(host.querySelector('#fee-panel-records')).not.toBeNull();

    component.selectPreview('payments');
    fixture.detectChanges();
    expect(host.querySelector('#fee-panel-payments')).not.toBeNull();
  });

  it('keeps illustrative overview and student record amounts consistent', () => {
    const host = fixture.nativeElement as HTMLElement;
    const overviewAmounts = Array.from(host.querySelectorAll('.hero-metrics strong'), element =>
      Number(element.textContent?.replace(/[^\d]/g, '')),
    );

    expect(overviewAmounts).toEqual([1250000, 925000, 325000]);
    expect(overviewAmounts[1] + overviewAmounts[2]).toBe(overviewAmounts[0]);

    component.selectPreview('records');
    fixture.detectChanges();
    expect(host.querySelector('.fee-table')?.textContent).toContain('₹18,500');
    expect(host.querySelector('.fee-table')?.textContent).toContain('₹6,500');
    expect(host.querySelector('.fee-table')?.textContent).toContain('₹20,500');
  });

  it('uses accessible tabs and keeps the sample-data disclosure unobtrusive', () => {
    const host = fixture.nativeElement as HTMLElement;
    const tabs = host.querySelectorAll('[role="tab"]');

    expect(tabs.length).toBe(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('.sample-note')?.textContent).toContain('Illustrative sample data');
    expect(host.textContent).not.toContain('Illustrative Fee Management Preview');
  });
});
