import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';

import { ApiService } from '../../../../core/services/api.service';

import {
  Student,
  StudentDetails,
  CreateStudentRequest,
  UpdateStudentRequest
} from '../models/student.model';

export interface StudentPage {
  content: Student[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface StudentMarkResult {
  examId: number;
  title: string;
  examDate: string;
  maximumMarks: number;
  subjectName: string;
  subjectCode: string;
  markStatus: 'PENDING' | 'SCORED' | 'ABSENT' | 'EXEMPT' | 'NOT_APPLICABLE';
  score: number | null;
}

export interface StudentMarksPage {
  content: StudentMarkResult[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface StudentImportError {
  rowNumber: number;
  field: string;
  message: string;
}

export type StudentImportResolutionAction = 'MAP' | 'CREATE' | 'SKIP';

export type StudentImportResolutionMasterDataType =
  | 'BRANCH'
  | 'BOARD_MEDIUM'
  | 'SCHOOL'
  | 'ACADEMIC_YEAR'
  | 'CLASS'
  | 'SECTION'
  | 'FEE_STRUCTURE';

export interface StudentImportResolutionIssue {
  masterDataType: StudentImportResolutionMasterDataType;
  sourceValue: string;
  affectedRowCount: number;
  academicYear: string | null;
  className: string | null;
}

export interface StudentImportResolutionDecision {
  masterDataType: StudentImportResolutionMasterDataType;
  sourceValue: string;
  academicYear: string | null;
  className: string | null;
  action: StudentImportResolutionAction;
  targetId: number | null;
}

export interface BulkUpdateStudentRequest {
  studentIds: number[];
  selectedFields: string[];

  name?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  gender?: 'Male' | 'Female' | null;
  isActive?: boolean;

  schoolId?: number | null;
  branchId?: number | null;
  boardMediumId?: number | null;

  academicYearId?: number;
  classId?: number;
  sectionId?: number;
}

export interface BulkDeleteStudentsRequest {
  studentIds: number[];
  deleteLinkedData: true;
}

export interface BulkDeleteStudentsResponse {
  deletedCount: number;
  deletedStudentIds: number[];
}


export interface StudentImportPreview {
  branches: string[];
  boardMedia: string[];
  schools: string[];

  academicYears: {
    name: string;
    startDate: string | null;
    endDate: string | null;
  }[];

  classes: {
    academicYear: string;
    name: string;
  }[];

  sections: {
    academicYear: string;
    className: string;
    name: string;
  }[];

  feeStructures: {
    academicYear: string;
    className: string;
    feeAmount: number | null;
    reactivatingExisting: boolean;
  }[];

  resolutionIssues: StudentImportResolutionIssue[];
}

export interface StudentImportValidationResponse {
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: StudentImportError[];
  preview: StudentImportPreview;
}

export interface ImportedStudentCredential {
  name: string;
  email: string;
  temporaryPassword: string;
}

export interface StudentImportResult {
  importedStudents: number;
  skippedStudents: number;
  students: ImportedStudentCredential[];
}

export interface StudentImportSetupRequest {
  branches: {
    name: string;
    approved: boolean;
  }[];

  boardMedia: {
    name: string;
    approved: boolean;
  }[];

  schools: {
    name: string;
    approved: boolean;
  }[];

  academicYears: {
    name: string;
    startDate: string | null;
    endDate: string | null;
    approved: boolean;
  }[];

  classes: {
    academicYear: string;
    name: string;
    approved: boolean;
  }[];

  sections: {
    academicYear: string;
    className: string;
    name: string;
    approved: boolean;
  }[];

  feeStructures: {
    academicYear: string;
    className: string;
    feeAmount: number | null;
    approved: boolean;
  }[];

  resolutionDecisions?: StudentImportResolutionDecision[];
}
@Injectable({
  providedIn: 'root'
})
export class StudentService {

  private readonly api = inject(ApiService);

  // =========================
  // GET STUDENTS
  // =========================

getStudents(
  page = 0,
    size = 50,
  search = '',
  academicYearId?: number,
  classId?: number,
  sectionId?: number,
  sortBy: string | null = 'name',
  sortDirection: 'asc' | 'desc' | null = 'asc'
): Observable<ApiResponse<StudentPage>> {

  let params = new HttpParams()
    .set('page', page)
    .set('size', size)
    .set('search', search);

  if (sortBy && sortDirection) {
    params = params
      .set('sortBy', sortBy)
      .set('sortDirection', sortDirection);
  }

  if (academicYearId != null) {
    params = params.set(
      'academicYearId',
      academicYearId
    );
  }

  if (classId != null) {
    params = params.set(
      'classId',
      classId
    );
  }

  if (sectionId != null) {
    params = params.set(
      'sectionId',
      sectionId
    );
  }

  return this.api.get<ApiResponse<StudentPage>>(
    '/students',
    params
  );
}

  // =========================
  // GET STUDENTS FOR EXPORT
  // =========================

  getStudentsForExport(
    search = '',
    academicYearId?: number,
    classId?: number,
    sectionId?: number
  ): Observable<ApiResponse<StudentPage>> {

    return this.getStudents(
      0,
      10000,
      search,
      academicYearId,
      classId,
      sectionId
    );
  }


  // =========================
  // GET STUDENT BY ID
  // =========================

  getStudentById(
    id: number
  ): Observable<ApiResponse<StudentDetails>> {

    return this.api.get<ApiResponse<StudentDetails>>(
      `/students/${id}`
    );
  }

  getStudentMarks(
    id: number,
    page = 0,
    size = 20
  ): Observable<ApiResponse<StudentMarksPage>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', 'examDate')
      .set('sortDirection', 'desc');

    return this.api.get<ApiResponse<StudentMarksPage>>(
      `/students/${id}/marks`, params
    );
  }


  // =========================
  // CREATE STUDENT
  // =========================

  createStudent(
    request: CreateStudentRequest
  ): Observable<ApiResponse<StudentDetails>> {

    return this.api.post<ApiResponse<StudentDetails>>(
      '/students',
      request
    );
  }


  // =========================
  // UPDATE STUDENT
  // =========================

  updateStudent(
    id: number,
    request: UpdateStudentRequest
  ): Observable<ApiResponse<StudentDetails>> {

    return this.api.put<ApiResponse<StudentDetails>>(
      `/students/${id}`,
      request
    );
  }

  bulkUpdateStudents(
  request: BulkUpdateStudentRequest
): Observable<ApiResponse<StudentDetails[]>> {

  return this.api.patch<ApiResponse<StudentDetails[]>>(
    '/students/bulk',
    request
  );
  }

  bulkDeleteStudents(
    request: BulkDeleteStudentsRequest
  ): Observable<ApiResponse<BulkDeleteStudentsResponse>> {
    return this.api.post<ApiResponse<BulkDeleteStudentsResponse>>(
      '/students/bulk-delete',
      request
    );
  }


  // =========================
  // UPDATE STATUS
  // =========================

  updateStatus(
    id: number,
    isActive: boolean
  ): Observable<ApiResponse<void>> {

    return this.api.patch<ApiResponse<void>>(
      `/students/${id}/status`,
      {
        isActive
      }
    );
  }

    // =========================
  // DELETE STUDENT
  // =========================

  deleteStudent(
    id: number
  ): Observable<ApiResponse<void>> {

    return this.api.delete<ApiResponse<void>>(
      `/students/${id}`
    );
  }

  // =========================
// BULK IMPORT
// =========================

downloadImportTemplate(): Observable<Blob> {
  return this.api.getBlob(
    '/students/import/template'
  );
}

validateImport(
  file: File
): Observable<ApiResponse<StudentImportValidationResponse>> {

  const formData = new FormData();

  formData.append('file', file);

  return this.api.postFormData<
    ApiResponse<StudentImportValidationResponse>
  >(
    '/students/import/validate',
    formData
  );
}

importStudents(
  file: File,
  setupRequest: StudentImportSetupRequest
): Observable<ApiResponse<StudentImportResult>> {

  const formData = new FormData();

  formData.append('file', file);
  formData.append(
    'setupRequest',
    new Blob(
      [JSON.stringify(setupRequest)],
      { type: 'application/json' }
    )
  );

  return this.api.postFormData<
    ApiResponse<StudentImportResult>
  >(
    '/students/import',
    formData
  );
}
}
