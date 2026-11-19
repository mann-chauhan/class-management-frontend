import { CommonModule } from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  input,
  output
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';
import { ClassService } from '../../academic/classes/class.service';

import {
  FeeStructureService
} from '../services/fee-structure.service';

import {
  CreateFeeStructureRequest
} from '../models/fee-structure.model';

import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';


@Component({
  selector: 'app-fee-structure-create',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    InlineFeedbackComponent
  ],

  templateUrl: './fee-structure-create.html',
  styleUrl: './fee-structure-create.scss'
})
export class FeeStructureCreateComponent implements OnInit {

  // =====================================================
  // MODAL
  // =====================================================

  modal = input(false);

  created = output<void>();

  cancelled = output<void>();


  // =====================================================
  // SERVICES
  // =====================================================

  private readonly academicYearService =
    inject(AcademicYearService);

  private readonly classService =
    inject(ClassService);

  private readonly feeStructureService =
    inject(FeeStructureService);

  private readonly router =
    inject(Router);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);


  // =====================================================
  // DATA
  // =====================================================

  academicYears: {
    id: number;
    name: string;
    isCurrent: boolean;
  }[] = [];

  classes: {
    id: number;
    name: string;
    academicYearId: number;
  }[] = [];


  // =====================================================
  // FORM
  // =====================================================

  form = {
    academicYearId: 0,
    classId: 0,
    feeAmount: null as number | null
  };


  // =====================================================
  // STATE
  // =====================================================

  loading = false;

  saving = false;

  errorMessage = '';


  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {

    this.loadData();

  }


  // =====================================================
  // LOAD DATA
  // =====================================================

  private loadData(): void {

    this.loading = true;
    this.errorMessage = '';

    this.academicYearService
      .getAll()
      .subscribe({

        next: response => {

          const years = response.data.content ?? [];

          this.academicYears =
            years.map(year => ({
              id: year.id,
              name: year.name,
              isCurrent: year.isCurrent
            }));

          this.classService
            .getClasses()
            .subscribe({

              next: classesResponse => {

                this.classes =
                  classesResponse.data.map(cls => ({
                    id: cls.id,
                    name: cls.name,
                    academicYearId:
                      cls.academicYearId
                  }));

                const currentYear =
                  this.academicYearService.findCurrentYear(years);

                this.form.academicYearId = currentYear?.id ?? 0;
                this.updateClassSelection();


                this.loading = false;

                this.cdr.markForCheck();

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


  // =====================================================
  // ACADEMIC YEAR CHANGE
  // =====================================================

  onAcademicYearChange(): void {

    this.form.classId = 0;

    this.updateClassSelection();

  }


  // =====================================================
  // FILTER CLASSES
  // =====================================================

  private updateClassSelection(): void {

    const selectedYearId =
      this.form.academicYearId;

    const availableClasses =
      this.classes.filter(
        cls =>
          cls.academicYearId === selectedYearId
      );


    const selectedClassIsAvailable =
      availableClasses.some(
        classroom => classroom.id === this.form.classId
      );

    if (!selectedClassIsAvailable && availableClasses.length) {

      this.form.classId =
        availableClasses[0].id;

    } else if (!selectedClassIsAvailable) {

      this.form.classId = 0;

    }


    this.cdr.markForCheck();

  }


  // =====================================================
  // GET AVAILABLE CLASSES
  // =====================================================

  get filteredClasses() {

    return this.classes.filter(
      cls =>
        cls.academicYearId ===
        this.form.academicYearId
    );

  }


  // =====================================================
  // SAVE
  // =====================================================

  save(): void {

    this.errorMessage = '';


    // Academic Year validation
    if (!this.form.academicYearId) {

      this.errorMessage =
        'Please select an academic year.';

      return;

    }


    // Class validation
    if (!this.form.classId) {

      this.errorMessage =
        'Please select a class.';

      return;

    }


    // Fee validation
    if (
      this.form.feeAmount === null ||
      this.form.feeAmount <= 0
    ) {

      this.errorMessage =
        'Please enter a valid fee amount.';

      return;

    }


    const request:
      CreateFeeStructureRequest = {

      academicYearId:
        this.form.academicYearId,

      classId:
        this.form.classId,

      feeAmount:
        this.form.feeAmount

    };


    this.saving = true;


    this.feeStructureService
      .create(request)
      .subscribe({

        next: (response: any) => {

          this.saving = false;


          // =================================================
          // MODAL MODE
          // =================================================

          if (this.modal()) {

            this.created.emit();

            return;

          }

          this.feedbackService.show({
            kind: 'success',
            message: response?.message || 'Fee structure created successfully.',
            persistAcrossNavigation: true
          });


          // =================================================
          // NORMAL PAGE MODE
          // =================================================

          this.router.navigate([
            '/admin/fees/fee-structures'
          ]);

        },


        error: error => {

          console.error(
            'Failed to create fee structure:',
            error
          );

          this.saving = false;

          this.errorMessage =
            error?.error?.message ||
            'Failed to create fee structure.';

          this.cdr.markForCheck();

        }

      });

  }


  // =====================================================
  // CANCEL
  // =====================================================

  cancel(): void {

    if (this.saving) {
      return;
    }


    // ===================================================
    // MODAL MODE
    // ===================================================

    if (this.modal()) {

      this.cancelled.emit();

      return;

    }


    // ===================================================
    // NORMAL PAGE MODE
    // ===================================================

    this.router.navigate([
      '/admin/fees/fee-structures'
    ]);

  }

}
