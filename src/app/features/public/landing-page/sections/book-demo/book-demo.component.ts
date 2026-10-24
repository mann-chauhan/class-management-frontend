import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-book-demo',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './book-demo.component.html',
  styleUrl: './book-demo.component.scss',
})
export class BookDemoComponent {
  readonly demoForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/.*\S.*/)],
    }),
    instituteName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150), Validators.pattern(/.*\S.*/)],
    }),
    designation: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  submissionNotice = '';

  showError(field: 'name' | 'instituteName' | 'designation'): boolean {
    const control = this.demoForm.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  fieldError(field: 'name' | 'instituteName' | 'designation'): string {
    const control = this.demoForm.controls[field];
    if (control.hasError('required') || control.hasError('pattern')) {
      return 'This field is required.';
    }
    if (control.hasError('maxlength')) {
      return field === 'name'
        ? 'Your name must be 100 characters or fewer.'
        : 'Institute name must be 150 characters or fewer.';
    }
    return '';
  }

  requestDemo(): void {
    this.demoForm.markAllAsTouched();
    this.submissionNotice = '';

    if (this.demoForm.invalid) {
      return;
    }

    this.submissionNotice =
      'Your details were not sent because a verified demo contact channel is not configured yet.';
  }
}
