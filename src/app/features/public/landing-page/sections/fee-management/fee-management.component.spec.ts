import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FeeManagementComponent } from './fee-management.component';

describe('FeeManagementComponent', () => {
  let fixture: ComponentFixture<FeeManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeManagementComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FeeManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('preserves section copy and removes the feature cards and visual caption', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('#fee-management')).toBeTruthy();
    expect(host.querySelector('#fees-title')?.textContent?.trim()).toBe('Manage Fees and Receipts');
    expect(host.querySelector('.section-heading > p:last-child')?.textContent?.trim()).toBe(
      'Configure fee structures, manage student fees, record payments and access receipts.',
    );
    expect(host.querySelector('.feature-card')).toBeNull();
    expect(host.querySelector('figcaption')).toBeNull();
  });

  it('renders the CSS fee dashboard with consistent illustrative totals and receipt details', () => {
    const host = fixture.nativeElement as HTMLElement;
    const figure = host.querySelector('figure') as HTMLElement;

    expect(figure.getAttribute('aria-label')).toBe('Illustrative fee management dashboard and receipt');
    expect(host.querySelector('.dashboard-brand-copy strong')?.textContent?.trim()).toBe('Fee Management');
    expect(host.querySelector('.dashboard-brand-copy small')?.textContent?.trim()).toBe('Academic Year 2026\u201327');

    const metricValues = Array.from(host.querySelectorAll('.metric-card > strong'), (value: Element) =>
      Number(value.textContent?.replace(/[^\d]/g, '')),
    );
    expect(metricValues).toEqual([1250000, 925000, 325000]);
    expect(metricValues[1] + metricValues[2]).toBe(metricValues[0]);
    expect(host.querySelector('.collection-progress')?.getAttribute('aria-label')).toBe(
      '74 percent of illustrative total fees collected',
    );

    const rows = host.querySelectorAll('.records-table tbody tr');
    expect(rows.length).toBe(3);
    expect(host.querySelector('.records-table')?.textContent).toContain('A. Patel');
    expect(host.querySelector('.records-table')?.textContent).toContain('M. Shah');
    expect(host.querySelector('.records-table')?.textContent).toContain('R. Das');
    expect(host.querySelectorAll('.paid-status').length).toBe(2);
    expect(host.querySelectorAll('.pending-status').length).toBe(1);

    expect(host.querySelector('.receipt-number')?.textContent?.trim()).toBe('RCP-2026-0148');
    expect(host.querySelector('.receipt-details')?.textContent).toContain('A. Patel');
    expect(host.querySelector('.receipt-details')?.textContent).toContain('\u20b98,500');
    expect(host.querySelector('.receipt-confirmation')?.textContent).toContain('Payment Recorded');
    expect(host.querySelector('.fee-explore-link')?.getAttribute('href')).toBe('/features/fee-management');
    expect(host.querySelector('.fee-explore-link')?.textContent).toContain('Explore Fee Management');
    expect(host.querySelector('.fee-explore-link span[aria-hidden="true"]')?.textContent?.trim()).toBe('→');
    expect(host.querySelector('button, input')).toBeNull();
  });
});
