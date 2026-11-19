import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SubjectService, SubjectRequest } from './subject.service';
import { Subject } from './subject.model';
import { ClassService } from '../classes/class.service';
import { AcademicClass } from '../classes/class.model';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import {
  DataTableComponent,
  TableAction,
  TableColumn
} from '../../../../shared/components/data-table/data-table.component';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-subjects',
  standalone: true,
imports: [
  CommonModule,
  FormsModule,
  ConfirmationDialogComponent,
  DataTableComponent,
  InlineFeedbackComponent
],
  templateUrl: './subjects.html',
  styleUrl: './subjects.scss'
})
export class SubjectsComponent implements OnInit {
  private readonly subjectService = inject(SubjectService);
  private readonly classService = inject(ClassService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly feedbackService = inject(ActionFeedbackService);

  searchTerm = '';
  classFilter: number | 'ALL' = 'ALL';

  showForm = false;
  editingSubject: Subject | null = null;

  subjects: Subject[] = [];

  columns: TableColumn[] = [
  {
    key: 'name',
    label: 'Subject',
    width: '320px',
    type: 'subject-identity',
    sortable: true
  },
  {
    key: 'academicYear',
    label: 'Academic Year',
    sortable: true
  }
];


actions: TableAction[] = [
  {
    label: 'Edit',
    type: 'edit'
  },
  {
    label: 'Delete',
    type: 'delete',
    danger: true
  }
];
  classes: { id: number; name: string; academicYear: string }[] = [];

  loading = false;
  saving = false;
  deleting = false;
  errorMessage = '';
  // DELETE CONFIRMATION

showDeleteDialog = false;

subjectToDelete: Subject | null = null;

  form = {
    name: '',
    code: '',
    classId: 0
  };

  ngOnInit(): void {
    this.loadClasses();
    this.loadSubjects();
  }

  loadClasses(): void {
    this.classService.getClasses().subscribe({
      next: response => {
        this.classes = response.data.map((academicClass: AcademicClass) => ({
          id: academicClass.id,
          name: academicClass.name,
          academicYear: academicClass.academicYear ?? ''
        }));

        if (!this.form.classId && this.classes.length > 0) {
          this.form.classId = this.classes[0].id;
        }

        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Failed to load classes:', error);
        this.errorMessage =
          error?.error?.message || 'Failed to load classes.';
        this.cdr.markForCheck();
      }
    });
  }

  loadSubjects(): void {
    this.loading = true;
    this.errorMessage = '';

    

    this.subjectService.getSubjects().subscribe({
      next: response => {
        this.subjects = response.data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Failed to load subjects:', error);
        this.errorMessage =
          error?.error?.message || 'Failed to load subjects.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get filteredSubjects(): Subject[] {
    return this.subjects.filter(subject => {
      const search = this.searchTerm.toLowerCase().trim();

      const matchesSearch =
        !search ||
        subject.name.toLowerCase().includes(search) ||
        subject.code.toLowerCase().includes(search);

      const matchesClass =
        this.classFilter === 'ALL' ||
        subject.classId === this.classFilter;

      return matchesSearch && matchesClass;
    });
  }

  openAddForm(): void {
    this.editingSubject = null;
    this.errorMessage = '';

    this.form = {
      name: '',
      code: '',
      classId: this.classes[0]?.id ?? 0
    };

    this.showForm = true;
  }

  openEditForm(subject: Subject): void {
    this.editingSubject = subject;
    this.errorMessage = '';

    this.form = {
      name: subject.name,
      code: subject.code,
      classId: subject.classId
    };

    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingSubject = null;
  }

  saveSubject(): void {
    if (this.saving) {
      return;
    }

    const name = this.form.name.trim();
    const code = this.form.code.trim();

    if (!name || !code || !this.form.classId) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    const request: SubjectRequest = {
      name,
      code,
      classId: this.form.classId
    };

    if (this.editingSubject) {
      this.subjectService
        .updateSubject(this.editingSubject.id, request)
        .subscribe({
          next: response => {
            this.saving = false;
            this.feedbackService.show({
              kind: 'success',
              message: response.message || 'Subject updated successfully.'
            });
            this.closeForm();
            this.loadSubjects();
          },
          error: error => {
            this.errorMessage =
              error?.error?.message || 'Failed to update subject.';
            this.saving = false;
            this.cdr.markForCheck();
          }
        });

      return;
    }

    this.subjectService.createSubject(request).subscribe({
      next: response => {
        this.saving = false;
        this.feedbackService.show({
          kind: 'success',
          message: response.message || 'Subject created successfully.'
        });
        this.closeForm();
        this.loadSubjects();
      },
      error: error => {
        this.errorMessage =
          error?.error?.message || 'Failed to create subject.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteSubject(subject: Subject): void {
  this.subjectToDelete = subject;
  this.showDeleteDialog = true;

  this.cdr.markForCheck();
}

cancelDeleteSubject(): void {
  this.showDeleteDialog = false;
  this.subjectToDelete = null;

  this.cdr.markForCheck();
}

confirmDeleteSubject(): void {
  const subject = this.subjectToDelete;

  if (!subject || this.deleting) {
    return;
  }

  this.deleting = true;
  this.showDeleteDialog = false;
  this.subjectToDelete = null;

  this.errorMessage = '';

  this.subjectService
    .deleteSubject(subject.id)
    .subscribe({
      next: response => {
        this.deleting = false;
        this.feedbackService.show({
          kind: 'success',
          message: response.message || 'Subject deleted successfully.'
        });
        this.loadSubjects();
      },

      error: error => {
        this.deleting = false;
        this.errorMessage =
          error?.error?.message ||
          'Failed to delete subject.';

        this.cdr.markForCheck();
      }
    });
}

onActionClick(event: {
  action: TableAction;
  row: Subject;
}): void {

  const { action, row } = event;

  switch (action.type) {

    case 'edit':
      this.openEditForm(row);
      break;

    case 'delete':
      this.deleteSubject(row);
      break;
  }
}
}
