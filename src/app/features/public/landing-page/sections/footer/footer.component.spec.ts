import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FooterComponent] }).compileComponents();
    fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the CMS brand and verified internal navigation without a copyright line', () => {
    const host = fixture.nativeElement as HTMLElement;
    const logoLink = host.querySelector('.brand-link') as HTMLAnchorElement;
    const logo = host.querySelector('.brand-logo') as HTMLImageElement;
    const company = host.querySelector('nav[aria-labelledby="footer-company-title"]');
    const links = Array.from(company?.querySelectorAll('a') ?? [], (link: HTMLAnchorElement) =>
      link.getAttribute('href'),
    );

    expect(logoLink.getAttribute('href')).toBe('#top');
    expect(logo.alt).toBe('CMS — Class Management System');
    expect(logo.getAttribute('src')).toBe('/assets/images/cms_logo.png');
    expect(host.textContent).toContain(
      'A connected platform for managing academic workflows, students, teachers, attendance, fees and assessments.',
    );
    expect(host.querySelector('#footer-company-title')?.textContent?.trim()).toBe('Company');
    expect(links).toEqual(['#academic-management', '#institutions', '#access-control', '/login']);
    expect(host.querySelector('.footer-bottom')).toBeNull();
    expect(host.textContent).not.toContain('Hyperbot Technologies Private Limited');
  });

  it('does not invent social destinations or add a Resources column', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.footer-connect h2')?.textContent?.trim()).toBe('Connect');
    expect(host.querySelector('.footer-connect a')).toBeNull();
    expect(host.textContent).toContain('Public contact and social links are not configured.');
    expect(host.textContent).not.toContain('Resources');
    expect(host.querySelector('a[href="#"]')).toBeNull();
  });

  it('can point company links back to landing-page sections', () => {
    fixture.componentRef.setInput('landingSectionPrefix', '/');
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.footer-column a'),
      (link: HTMLAnchorElement) => link.getAttribute('href'),
    );

    expect(links).toEqual([
      '/#academic-management',
      '/#institutions',
      '/#access-control',
      '/login',
    ]);
  });
});
