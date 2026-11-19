import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { App } from './app';
import { ActionFeedbackHostComponent } from './shared/components/action-feedback/action-feedback-host.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the application router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(RouterOutlet))).toBeTruthy();
  });

  it('should render the root action feedback host', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(ActionFeedbackHostComponent))).toBeTruthy();
  });
});
