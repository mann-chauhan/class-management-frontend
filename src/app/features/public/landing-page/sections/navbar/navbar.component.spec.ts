import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should render the header and accessible main navigation', () => {
    const header = fixture.nativeElement.querySelector('header');
    const navigation = fixture.nativeElement.querySelector('nav[aria-label="Main navigation"]');
    const menuToggle = fixture.nativeElement.querySelector(
      'button[aria-controls="primary-navigation"]',
    );

    expect(header).toBeTruthy();
    expect(navigation).toBeTruthy();
    expect(menuToggle).toBeTruthy();
  });

  it('should preserve the feature, solution, and about destinations', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.primary-nav a'),
      (link: HTMLAnchorElement) => [link.textContent?.trim(), link.getAttribute('href')],
    );

    expect(links).toEqual([
      ['Features', '#academic-management'],
      ['Solutions', '#institutions'],
      ['About', '#access-control'],
    ]);
  });

  it('should render the supplied CMS logo and preserve the home and Login destinations', () => {
    const brand = fixture.nativeElement.querySelector('.brand-link') as HTMLAnchorElement;
    const logo = brand.querySelector('img') as HTMLImageElement;
    const login = fixture.nativeElement.querySelector('.sign-in-link') as HTMLAnchorElement;

    expect(brand.getAttribute('href')).toBe('/');
    expect(logo.getAttribute('src')).toBe('/assets/images/cms_logo.png');
    expect(logo.getAttribute('alt')).toBe('CMS — Class Management System');
    expect(logo.getAttribute('width')).toBe('56');
    expect(logo.getAttribute('height')).toBe('56');
    expect(login.textContent?.trim()).toBe('Login');
    expect(login.getAttribute('href')).toBe('/login');
  });

  it('should link the demo action to the existing demo section', () => {
    const demo = fixture.nativeElement.querySelector('.demo-link') as HTMLAnchorElement;

    expect(demo.textContent?.trim()).toBe('Book a Demo');
    expect(demo.getAttribute('href')).toBe('#book-a-demo');
  });

  it('can point section links back to the landing page without changing the local demo target', () => {
    fixture.componentRef.setInput('landingSectionPrefix', '/');
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.primary-nav a'),
      (link: HTMLAnchorElement) => link.getAttribute('href'),
    );
    const demo = fixture.nativeElement.querySelector('.demo-link') as HTMLAnchorElement;

    expect(links).toEqual(['/#academic-management', '/#institutions', '/#access-control']);
    expect(demo.getAttribute('href')).toBe('#book-a-demo');
  });

  it('should toggle the mobile menu and close it after selecting a navigation link', () => {
    const toggle = fixture.nativeElement.querySelector(
      'button[aria-controls="primary-navigation"]',
    ) as HTMLButtonElement;
    const navigationContainer = fixture.nativeElement.querySelector('#primary-navigation');

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    (
      navigationContainer.querySelector('a[href="#academic-management"]') as HTMLAnchorElement
    ).click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
