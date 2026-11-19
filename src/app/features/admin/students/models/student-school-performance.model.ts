export interface StudentSchoolPerformance {
  id: number;
  studentId: number;
  schoolId: number;
  schoolName: string;
  examName: string;
  examDate: string | null;
  maximumMarks: number;
  obtainedMarks: number;
  percentage: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StudentSchoolPerformanceSummary {
  totalExams: number;
  totalObtainedMarks: number;
  totalMaximumMarks: number;
  overallAveragePercentage: number | null;
  highestExamPercentage: number | null;
  schoolsRepresented: number;
  latestExamDate: string | null;
}

export interface CreateStudentSchoolPerformanceRequest {
  schoolId: number;
  examName: string;
  examDate: string | null;
  maximumMarks: number;
  obtainedMarks: number;
}

export interface UpdateStudentSchoolPerformanceRequest
  extends CreateStudentSchoolPerformanceRequest {
  version: number;
}

export interface StudentSchoolPerformancePage {
  content: StudentSchoolPerformance[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export type StudentSchoolPerformanceSortField =
  | 'examDate'
  | 'examName'
  | 'maximumMarks'
  | 'obtainedMarks'
  | 'schoolName'
  | 'createdAt'
  | 'updatedAt';

export type StudentSchoolPerformanceSortDirection = 'asc' | 'desc';

export interface StudentSchoolPerformanceListOptions {
  search?: string;
  schoolId?: number | null;
  sortBy?: StudentSchoolPerformanceSortField;
  sortDirection?: StudentSchoolPerformanceSortDirection;
}

export interface StudentSchoolPerformanceApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
