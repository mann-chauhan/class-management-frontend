import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { TeacherForm } from './teacher-form';
import { TeacherService } from '../services/teacher.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';

describe('TeacherForm', () => {
  let component: TeacherForm;
  let fixture: ComponentFixture<TeacherForm>;
  let teacherService: {
    createTeacher: ReturnType<typeof vi.fn>;
    updateTeacher: ReturnType<typeof vi.fn>;
    getTeacherById: ReturnType<typeof vi.fn>;
  };
  let feedbackService: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    teacherService = {
      createTeacher: vi.fn(() => of({})),
      updateTeacher: vi.fn(() => of({})),
      getTeacherById: vi.fn(() => of({ data: null }))
    };
    feedbackService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TeacherForm],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } }
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TeacherService, useValue: teacherService },
        { provide: ActionFeedbackService, useValue: feedbackService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize in create mode without a route id', () => {
    expect(component).toBeTruthy();
    expect(component.editing).toBe(false);
    expect(component.teacherId).toBeNull();
  });

  it('shows one non-persistent success feedback and emits saved for popup create', () => {
    component.popupMode = true;
    fillCreateForm();
    const saved = vi.spyOn(component.saved, 'emit');

    component.saveTeacher();

    expect(teacherService.createTeacher).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'secret',
      phone: '1234567890'
    });
    expect(feedbackService.show).toHaveBeenCalledTimes(1);
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Teacher created successfully.',
      persistAcrossNavigation: false
    });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows persistent success feedback for standalone update without sending a password', () => {
    component.editing = true;
    component.teacherId = 12;
    component.form = {
      teacherNumber: ' t-12 ',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'must-not-be-sent',
      phone: '1234567890'
    };

    component.saveTeacher();

    expect(teacherService.updateTeacher).toHaveBeenCalledWith(12, {
      teacherNumber: 'T-12',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '1234567890'
    });
    expect(feedbackService.show).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Teacher updated successfully.',
      persistAcrossNavigation: true
    });
  });

  it('prevents duplicate saves while the first request is pending', () => {
    const pending = new Subject<unknown>();
    teacherService.createTeacher.mockReturnValue(pending.asObservable());
    fillCreateForm();

    component.saveTeacher();
    component.saveTeacher();

    expect(teacherService.createTeacher).toHaveBeenCalledTimes(1);
    pending.error({ error: { message: 'Email already exists' } });
    expect(component.errorMessages).toEqual(['Email already exists']);
  });

  it('shows contextual validation errors without calling the API', () => {
    component.saveTeacher();

    expect(teacherService.createTeacher).not.toHaveBeenCalled();
    expect(component.errorMessages).toEqual([
      'First name is required.',
      'Last name is required.',
      'Email is required.',
      'Password is required.'
    ]);
  });

  it('uses the generic fallback for an unsafe API error shape', () => {
    teacherService.createTeacher.mockReturnValue(
      throwError(() => ({ error: { details: { password: 'secret' } } }))
    );
    fillCreateForm();

    component.saveTeacher();

    expect(component.errorMessages).toEqual(['Failed to create teacher.']);
    expect(component.errorMessages.join(' ')).not.toContain('secret');
  });

  it('preserves values and uses inline feedback after update failure', () => {
    component.editing = true;
    component.teacherId = 12;
    component.form = { teacherNumber: 'T-12', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', password: '', phone: '1234567890' };
    teacherService.updateTeacher.mockReturnValue(throwError(() => ({ error: { details: { password: 'secret' } } })));

    component.saveTeacher();

    expect(component.form.firstName).toBe('Ada');
    expect(component.errorMessages).toEqual(['Failed to update teacher.']);
    expect(component.saving).toBe(false);
    expect(feedbackService.show).not.toHaveBeenCalled();
  });

  it('prevents duplicate update submissions', () => {
    const pending = new Subject<unknown>();
    component.editing = true;
    component.teacherId = 12;
    component.form = { teacherNumber: 'T-12', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', password: '', phone: '1234567890' };
    teacherService.updateTeacher.mockReturnValue(pending.asObservable());

    component.saveTeacher();
    component.saveTeacher();

    expect(teacherService.updateTeacher).toHaveBeenCalledTimes(1);
  });

  function fillCreateForm(): void {
    component.form = {
      teacherNumber: '',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'secret',
      phone: '1234567890'
    };
  }
});
