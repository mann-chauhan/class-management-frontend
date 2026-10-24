import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrustedByComponent } from './trusted-by.component';

describe('TrustedByComponent', () => {
  let fixture: ComponentFixture<TrustedByComponent>;
  let component: TrustedByComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TrustedByComponent] }).compileComponents();
    fixture = TestBed.createComponent(TrustedByComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders a compact user review heading', () => {
    const host = fixture.nativeElement as HTMLElement;
    const section = host.querySelector('#trusted-by');

    expect(section?.getAttribute('aria-labelledby')).toBe('community-experiences-title');
    expect(host.querySelector('.eyebrow')?.textContent?.trim()).toBe('User Experiences');
    expect(host.querySelector('#community-experiences-title')?.textContent?.trim()).toBe(
      'What Our Users Say',
    );
  });

  it('shows exactly three clearly labelled sample reviews', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(component.testimonials.length).toBe(3);
    expect(host.querySelectorAll('.testimonial-card').length).toBe(3);
    expect(host.querySelectorAll('.sample-label').length).toBe(3);
    expect(host.querySelector('.section-heading small')?.textContent?.trim()).toBe(
      'Sample reviews shown for design preview.',
    );
  });

  it('does not add unrelated controls or forms', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('form')).toBeNull();
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('a')).toBeNull();
  });
});
