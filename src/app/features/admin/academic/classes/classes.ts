import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { AcademicClass } from './class.model';
import {
  Section,
  CreateSectionRequest,
  UpdateSectionRequest
} from './section.model';

import {
  ClassService,
  CreateClassRequest,
  UpdateClassRequest
} from './class.service';

import { SectionService } from './section.service';
import { AcademicYearService } from '../academic-years/services/academic-year.service';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';


interface FormSection {
  id?: number;
  name: string;
}


@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    SearchInputComponent,
    ConfirmationDialogComponent,
    InlineFeedbackComponent
  ],
  templateUrl: './classes.html',
  styleUrl: './classes.scss'
})
export class ClassesComponent implements OnInit {

  private readonly classService =
    inject(ClassService);

  private readonly sectionService =
    inject(SectionService);

  private readonly academicYearService =
    inject(AcademicYearService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);


  // =========================
  // FILTERS
  // =========================

  searchTerm = '';

  academicYearFilter: number | 'ALL' = 'ALL';

  openActionMenuId: number | null = null;


  // =========================
  // DATA
  // =========================

  academicYears: {
    id: number;
    name: string;
  }[] = [];

  classes: AcademicClass[] = [];


  // =========================
  // STATE
  // =========================

  loading = false;

  saving = false;

  deleting = false;

  errorMessage = '';

  // =========================
// DELETE CONFIRMATION
// =========================

showDeleteDialog = false;

deleteType: 'class' | 'section' | null = null;

classToDelete: AcademicClass | null = null;

sectionToDelete: Section | null = null;


  // =========================
  // CLASS FORM
  // =========================

  showForm = false;

  editingClass: AcademicClass | null = null;


  form = {
    name: '',
    academicYearId: 0
  };


  // =========================
  // SECTIONS IN SAME FORM
  // =========================

  formSections: FormSection[] = [];

  deletedSectionIds: number[] = [];


  // =========================
  // INIT
  // =========================

  ngOnInit(): void {
    this.loadClasses();
  }


  // =========================
  // SEARCH
  // =========================

  onSearch(value: string): void {
    this.searchTerm = value;
  }


  get filteredClasses(): AcademicClass[] {

    const search =
      this.searchTerm.trim().toLowerCase();

    return this.classes.filter(cls => {

      const matchesSearch =
        !search ||
        cls.name
          .toLowerCase()
          .includes(search);

      const matchesYear =
        this.academicYearFilter === 'ALL' ||
        cls.academicYearId ===
          this.academicYearFilter;

      return matchesSearch && matchesYear;
    });
  }


  // =========================
  // LOAD CLASSES
  // =========================

  loadClasses(): void {

    this.loading = true;
    this.errorMessage = '';

    this.academicYearService
      .getAll()
      .subscribe({

        next: yearsResponse => {

          this.academicYears =
            yearsResponse.data.content.map(year => ({
              id: year.id,
              name: year.name
            }));


          this.classService
            .getClasses()
            .subscribe({

              next: classesResponse => {

                this.classes =
                  classesResponse.data.map(cls => {

                    const year =
                      yearsResponse.data.content.find(
                        y =>
                          y.id ===
                          cls.academicYearId
                      );

                    return {
                      ...cls,

                      academicYear:
                        year?.name ?? '',

                      sections: []
                    };
                  });


                this.loadSections();
              },


              error: error => {

                console.error(
                  'Failed to load classes:',
                  error
                );

                this.errorMessage =
                  error?.error?.message ||
                  'Failed to load classes.';

                this.loading = false;

                this.cdr.markForCheck();
              }

            });
        },


        error: error => {

          console.error(
            'Failed to load academic years:',
            error
          );

          this.errorMessage =
            error?.error?.message ||
            'Failed to load academic years.';

          this.loading = false;

          this.cdr.markForCheck();
        }

      });
  }


  // =========================
  // LOAD SECTIONS
  // =========================

  private loadSections(): void {

    if (!this.classes.length) {

      this.loading = false;

      this.cdr.markForCheck();

      return;
    }


    const requests =
      this.classes.map(cls =>
        this.sectionService
          .getSections(cls.id)
      );


    forkJoin(requests)
      .subscribe({

        next: responses => {

          this.classes =
            this.classes.map(
              (cls, index) => ({

                ...cls,

                sections:
                  responses[index].data

              })
            );


          this.loading = false;

          this.cdr.markForCheck();
        },


        error: error => {

          console.error(
            'Failed to load sections:',
            error
          );

          this.errorMessage =
            error?.error?.message ||
            'Failed to load sections.';

          this.loading = false;

          this.cdr.markForCheck();
        }

      });
  }


  // =========================
  // ADD FORM
  // =========================

  toggleActionMenu(
  classId: number,
  event: Event
): void {

  event.stopPropagation();

  this.openActionMenuId =
    this.openActionMenuId === classId
      ? null
      : classId;
}

@HostListener('document:click')
onDocumentClick(): void {
  this.closeActionMenu();
}


closeActionMenu(): void {
  this.openActionMenuId = null;
}

  openAddForm(): void {

    this.editingClass = null;

    this.errorMessage = '';


    this.form = {

      name: '',

      academicYearId:
        this.academicYears[0]?.id ?? 0

    };


    this.formSections = [];

    this.deletedSectionIds = [];


    this.showForm = true;
  }


  // =========================
  // EDIT FORM
  // =========================

  openEditForm(
    cls: AcademicClass
  ): void {

    this.editingClass = cls;

    this.errorMessage = '';


    this.form = {

      name: cls.name,

      academicYearId:
        cls.academicYearId

    };


    this.formSections =
      cls.sections.map(section => ({

        id: section.id,

        name: section.name

      }));


    this.deletedSectionIds = [];


    this.showForm = true;
  }


  // =========================
  // CLOSE FORM
  // =========================

  closeForm(): void {

    if (this.saving) {
      return;
    }

    this.showForm = false;

    this.editingClass = null;

    this.formSections = [];

    this.deletedSectionIds = [];
  }


  // =========================
  // ADD SECTION TO FORM
  // =========================

  addSection(): void {

    this.formSections.push({

      name: ''

    });
  }


  // =========================
  // REMOVE SECTION FROM FORM
  // =========================

  removeSection(
    index: number
  ): void {

    const section =
      this.formSections[index];


    if (section?.id) {

      this.deletedSectionIds.push(
        section.id
      );
    }


    this.formSections.splice(
      index,
      1
    );
  }


  // =========================
  // SAVE CLASS + SECTIONS
  // =========================

  saveClass(): void {

    const name =
      this.form.name.trim();


    if (
      !name ||
      !this.form.academicYearId
    ) {

      this.errorMessage =
        'Please enter class name and academic year.';

      return;
    }


    const invalidSection =
      this.formSections.some(
        section =>
          !section.name.trim()
      );


    if (invalidSection) {

      this.errorMessage =
        'Please enter a name for every section.';

      return;
    }


    this.saving = true;

    this.errorMessage = '';


    const classRequest:
      CreateClassRequest | UpdateClassRequest = {

      name,

      academicYearId:
        this.form.academicYearId

    };


    // =========================
    // UPDATE EXISTING CLASS
    // =========================

    if (this.editingClass) {

      this.classService
        .updateClass(
          this.editingClass.id,
          classRequest
        )
        .pipe(

          switchMap(() =>
            this.saveSections(
              this.editingClass!.id
            )
          )

        )
        .subscribe({

          next: () => {

            this.saving = false;

            this.closeForm();

            this.loadClasses();
          },


          error: error => {

            console.error(
              'Failed to update class:',
              error
            );

            this.saving = false;

            this.errorMessage =
              error?.error?.message ||
              'Failed to update class and sections.';

            this.cdr.markForCheck();
          }

        });


      return;
    }


    // =========================
    // CREATE NEW CLASS
    // =========================

    this.classService
      .createClass(classRequest)
      .pipe(

        switchMap(response => {

          const classId =
            response.data.id;

          return this.createNewSections(
            classId
          );
        })

      )
      .subscribe({

        next: () => {

          this.saving = false;

          this.closeForm();

          this.loadClasses();
        },


        error: error => {

          console.error(
            'Failed to create class:',
            error
          );

          this.saving = false;

          this.errorMessage =
            error?.error?.message ||
            'Failed to create class and sections.';

          this.cdr.markForCheck();
        }

      });
  }


  // =========================
  // SAVE EXISTING SECTIONS
  // =========================

  private saveSections(
    classId: number
  ): Observable<unknown> {

    const requests:
      Observable<unknown>[] = [];


    // -------------------------
    // DELETE REMOVED SECTIONS
    // -------------------------

    for (
      const sectionId
      of this.deletedSectionIds
    ) {

      requests.push(
        this.sectionService
          .deleteSection(sectionId)
      );
    }


    // -------------------------
    // UPDATE / CREATE SECTIONS
    // -------------------------

    for (
      const section
      of this.formSections
    ) {

      const name =
        section.name.trim();


      if (section.id) {

        const request:
          UpdateSectionRequest = {

          classId,

          name

        };


        requests.push(
          this.sectionService
            .updateSection(
              section.id,
              request
            )
        );

      } else {

        const request:
          CreateSectionRequest = {

          classId,

          name

        };


        requests.push(
          this.sectionService
            .createSection(request)
        );
      }
    }


    if (!requests.length) {

      return of(null);
    }


    return forkJoin(requests);
  }


  // =========================
  // CREATE NEW SECTIONS
  // =========================

  private createNewSections(
    classId: number
  ): Observable<unknown> {

    const requests =
      this.formSections.map(
        section => {

          const request:
            CreateSectionRequest = {

            classId,

            name:
              section.name.trim()

          };


          return this.sectionService
            .createSection(request);
        }
      );


    if (!requests.length) {

      return of(null);
    }


    return forkJoin(requests);
  }


  // =========================
  // DELETE CLASS
  // =========================

  deleteClass(cls: AcademicClass): void {
  this.classToDelete = cls;
  this.sectionToDelete = null;
  this.deleteType = 'class';
  this.showDeleteDialog = true;

  this.cdr.markForCheck();
}

cancelDelete(): void {
  this.showDeleteDialog = false;
  this.classToDelete = null;
  this.sectionToDelete = null;
  this.deleteType = null;

  this.cdr.markForCheck();
}

confirmDeleteClass(): void {
  const cls = this.classToDelete;

  if (!cls || this.deleting) {
    return;
  }

  this.deleting = true;
  this.showDeleteDialog = false;
  this.classToDelete = null;
  this.deleteType = null;

  this.errorMessage = '';

  this.classService
    .deleteClass(cls.id)
    .subscribe({
      next: response => {
        this.deleting = false;
        this.feedbackService.show({
          kind: 'success',
          message: response.message || 'Class deleted successfully.'
        });
        this.loadClasses();
      },

      error: error => {
        this.deleting = false;
        this.errorMessage =
          error?.error?.message ||
          'Failed to delete class.';

        this.cdr.markForCheck();
      }
    });
}

  // =========================
  // DELETE SECTION
  // =========================

  deleteSection(section: Section): void {
  this.sectionToDelete = section;
  this.classToDelete = null;
  this.deleteType = 'section';
  this.showDeleteDialog = true;

  this.cdr.markForCheck();
}

confirmDeleteSection(): void {
  const section = this.sectionToDelete;

  if (!section || this.deleting) {
    return;
  }

  this.deleting = true;
  this.showDeleteDialog = false;
  this.sectionToDelete = null;
  this.deleteType = null;

  this.errorMessage = '';

  this.sectionService
    .deleteSection(section.id)
    .subscribe({
      next: response => {
        this.deleting = false;
        this.feedbackService.show({
          kind: 'success',
          message: response.message || 'Section deleted successfully.'
        });
        this.loadClasses();
      },

      error: error => {
        this.deleting = false;
        this.errorMessage =
          error?.error?.message ||
          'Failed to delete section.';

        this.cdr.markForCheck();
      }
    });
}

}
