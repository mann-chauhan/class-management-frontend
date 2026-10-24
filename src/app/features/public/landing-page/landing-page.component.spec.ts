import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LandingPageComponent } from './landing-page.component';

describe('LandingPageComponent', () => {
  let component: LandingPageComponent;
  let fixture: ComponentFixture<LandingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the approved hero headline', () => {
    const heading = fixture.nativeElement.querySelector('h1') as HTMLHeadingElement;

    expect(heading.textContent?.trim()).toBe(
      'Everything Your Institution Needs. All in One Place.',
    );
  });

  it('should render the sections in the expected order', () => {
    expect(fixture.nativeElement.querySelector('header')).toBeTruthy();

    const componentOrder = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.landing-page > app-navbar, .landing-page > main > app-hero, .landing-page > main > app-institution-categories, .landing-page > main > app-academic-management, .landing-page > main > app-teaching-operations, .landing-page > main > app-fee-management, .landing-page > main > app-role-experiences, .landing-page > main > app-access-control, .landing-page > main > app-book-demo, .landing-page > main > app-trusted-by, .landing-page > app-footer',
      ),
      (component: Element) => component.tagName.toLowerCase(),
    );

    expect(componentOrder).toEqual([
      'app-navbar',
      'app-hero',
      'app-institution-categories',
      'app-academic-management',
      'app-teaching-operations',
      'app-fee-management',
      'app-role-experiences',
      'app-access-control',
      'app-book-demo',
      'app-trusted-by',
      'app-footer',
    ]);

    const sectionIds = Array.from(
      fixture.nativeElement.querySelectorAll('main section'),
      (section: Element) => section.id,
    );

    expect(sectionIds).toEqual([
      '',
      'institutions',
      'academic-management',
      'teaching-operations',
      'fee-management',
      'roles',
      'access-control',
      'book-a-demo',
      'trusted-by',
    ]);

    expect(fixture.nativeElement.querySelector('footer')).toBeTruthy();
  });
});
