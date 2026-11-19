import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  DataTableComponent,
  TableAction,
  TableColumn
} from '../../../../shared/components/data-table/data-table.component';

import { AcademicYearService } from '../../academic/academic-years/services/academic-year.service';

import {
  FeeStructure
} from '../models/fee-structure.model';

import { FeeStructureService } from '../services/fee-structure.service';

import { FeeStructureCreateComponent } from '../fee-structure-create/fee-structure-create';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { InlineFeedbackComponent } from '../../../../shared/components/inline-feedback/inline-feedback.component';

@Component({
  selector: 'app-fee-structure-list',
  standalone: true,

  imports: [
    DataTableComponent,
    FormsModule,
    FeeStructureCreateComponent,
    InlineFeedbackComponent
  ],

  templateUrl: './fee-structure-list.html',
  styleUrl: './fee-structure-list.scss'
})
export class FeeStructureList implements OnInit {

  private readonly feeStructureService =
    inject(FeeStructureService);

  private readonly academicYearService =
    inject(AcademicYearService);

  private readonly router =
    inject(Router);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly feedbackService =
    inject(ActionFeedbackService);


  // =====================================================
  // MODAL
  // =====================================================

  isCreateModalOpen = false;


  closeCreateModal(): void {
    this.isCreateModalOpen = false;
  }


  onFeeStructureCreated(): void {
    this.isCreateModalOpen = false;
    this.loadFeeStructures();
    this.feedbackService.show({
      kind: 'success',
      message: 'Fee structure created successfully.'
    });
  }


  // =====================================================
  // DATA
  // =====================================================

  feeStructures: FeeStructure[] = [];

  academicYears: {
    id: number;
    name: string;
  }[] = [];


  // =====================================================
  // FILTER
  // =====================================================

  academicYearFilter: number | 'ALL' = 'ALL';

  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';


  get filteredFeeStructures(): FeeStructure[] {

    if (this.statusFilter === 'ALL') {
      return this.feeStructures;
    }

    if (this.statusFilter === 'ACTIVE') {
      return this.feeStructures.filter(
        fee => fee.isActive
      );
    }

    return this.feeStructures.filter(
      fee => !fee.isActive
    );
  }


  // =====================================================
  // STATE
  // =====================================================

  loading = false;

  errorMessage = '';
  loadingErrorMessage = '';
  mutationErrorMessage = '';
  private readonly pendingStatusIds = new Set<number>();


  // =====================================================
  // TABLE
  // =====================================================

  columns: TableColumn[] = [

    {
      key: 'className',
      label: 'Fee Structure',
      width: '45%',
      type: 'fee-structure-identity'
    },

    {
      key: 'feeAmount',
      label: 'Fee Amount',
      width: '25%',
      type: 'fee-amount',
      value: (row: FeeStructure) =>
        `₹${Number(row.feeAmount ?? 0).toLocaleString('en-IN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        })}`
    },

    {
      key: 'isActive',
      label: 'Status',
      width: '15%',
      type: 'status',
      align: 'center'
    }

  ];


  // =====================================================
  // ACTIONS
  // =====================================================

  actions: TableAction[] = [

    {
      label: 'Edit',
      type: 'edit'
    }

  ];


  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {

    this.loadAcademicYears();

  }


  // =====================================================
  // LOAD ACADEMIC YEARS
  // =====================================================

  private loadAcademicYears(): void {

    this.loading = true;
    this.loadingErrorMessage = '';
    this.errorMessage = '';

    this.academicYearService
      .getAll()
      .subscribe({

        next: response => {

          this.academicYears =
            response.data.content.map(year => ({
              id: year.id,
              name: year.name
            }));

          this.loadFeeStructures();

        },

        error: error => {

          console.error(
            'Failed to load academic years',
            error
          );

          this.loadingErrorMessage =
            error?.error?.message ??
            'Failed to load academic years.';
          this.errorMessage = this.loadingErrorMessage;

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }


  // =====================================================
  // LOAD FEE STRUCTURES
  // =====================================================

  loadFeeStructures(): void {

    this.loading = true;
    this.loadingErrorMessage = '';
    this.errorMessage = '';

    const academicYearId =
      this.academicYearFilter === 'ALL'
        ? undefined
        : this.academicYearFilter;

    this.feeStructureService
      .getAll(academicYearId)
      .subscribe({

        next: (response: FeeStructure[]) => {

          this.feeStructures =
            response ?? [];

          this.loading = false;

          this.cdr.detectChanges();

        },

        error: error => {

          console.error(
            'Failed to load fee structures',
            error
          );

          this.loadingErrorMessage =
            error?.error?.message ??
            'Failed to load fee structures.';
          this.errorMessage = this.loadingErrorMessage;

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }


  // =====================================================
  // FILTER
  // =====================================================

  onAcademicYearChange(): void {

    this.loadFeeStructures();

  }


  onStatusChange(): void {

    this.cdr.detectChanges();

  }


  // =====================================================
  // CREATE
  // =====================================================

  createFeeStructure(): void {

    this.isCreateModalOpen = true;

  }


  // =====================================================
  // ROW ACTIONS
  // =====================================================

  getRowActions(
    feeStructure: FeeStructure
  ): TableAction[] {

    const actions: TableAction[] = [

      {
        label: 'Edit',
        type: 'edit'
      }

    ];

    if (feeStructure.isActive) {

      actions.push({
        label: this.pendingStatusIds.has(feeStructure.id)
          ? 'Deactivating...'
          : 'Deactivate',
        type: 'deactivate',
        danger: true
      });

    } else {

      actions.push({
        label: this.pendingStatusIds.has(feeStructure.id)
          ? 'Activating...'
          : 'Activate',
        type: 'activate'
      });

    }

    return actions;

  }


  // =====================================================
  // ACTION CLICK
  // =====================================================

  onActionClick(event: {
    action: TableAction;
    row: FeeStructure;
  }): void {

    const {
      action,
      row
    } = event;

    switch (action.type) {

      case 'edit':

        this.editFeeStructure(row);

        break;

      case 'activate':

        this.activateFeeStructure(row);

        break;

      case 'deactivate':

        this.deactivateFeeStructure(row);

        break;

    }

  }


  // =====================================================
  // EDIT
  // =====================================================

  editFeeStructure(
    feeStructure: FeeStructure
  ): void {

    this.router.navigate([
      '/admin/fees/fee-structures',
      feeStructure.id,
      'edit'
    ]);

  }


  // =====================================================
  // ACTIVATE
  // =====================================================

  activateFeeStructure(
    feeStructure: FeeStructure
  ): void {

    if (feeStructure.isActive) {
      return;
    }

    if (this.pendingStatusIds.has(feeStructure.id)) {
      return;
    }

    this.pendingStatusIds.add(feeStructure.id);
    this.mutationErrorMessage = '';
    this.errorMessage = '';

    this.feeStructureService
      .updateStatus(
        feeStructure.id,
        {
          isActive: true
        }
      )
      .subscribe({

        next: (response: any) => {

          this.pendingStatusIds.delete(feeStructure.id);
          this.loadFeeStructures();
          this.feedbackService.show({
            kind: 'success',
            message: response?.message || 'Fee structure activated successfully.'
          });

        },

        error: error => {

          this.pendingStatusIds.delete(feeStructure.id);

          console.error(
            'Failed to activate fee structure',
            error
          );

          this.mutationErrorMessage =
            error?.error?.message ??
            'Failed to activate fee structure.';
          this.errorMessage = this.mutationErrorMessage;

          this.cdr.detectChanges();

        }

      });

  }


  // =====================================================
  // DEACTIVATE
  // =====================================================

  deactivateFeeStructure(
    feeStructure: FeeStructure
  ): void {

    if (!feeStructure.isActive) {
      return;
    }

    if (this.pendingStatusIds.has(feeStructure.id)) {
      return;
    }

    this.pendingStatusIds.add(feeStructure.id);
    this.mutationErrorMessage = '';
    this.errorMessage = '';

    this.feeStructureService
      .updateStatus(
        feeStructure.id,
        {
          isActive: false
        }
      )
      .subscribe({

        next: (response: any) => {

          this.pendingStatusIds.delete(feeStructure.id);
          this.loadFeeStructures();
          this.feedbackService.show({
            kind: 'success',
            message: response?.message || 'Fee structure deactivated successfully.'
          });

        },

        error: error => {

          this.pendingStatusIds.delete(feeStructure.id);

          console.error(
            'Failed to deactivate fee structure',
            error
          );

          this.mutationErrorMessage =
            error?.error?.message ??
            'Failed to deactivate fee structure.';
          this.errorMessage = this.mutationErrorMessage;

          this.cdr.detectChanges();

        }

      });

  }


  // =====================================================
  // BACK TO FEE MANAGEMENT
  // =====================================================

  goBackToFeeManagement(): void {

    this.router.navigate([
      '/admin/fees'
    ]);

  }

}
