export interface Student {
  id: number;
  rollNumber: string;
  name: string;
  email: string;
  phone: string | null;
  alternatePhone: string | null;
  address: string | null;
  isActive: boolean;

  academicYearId: number;
  academicYearName: string;

  classId: number;
  className: string;

  sectionId: number;
  sectionName: string;

  schoolId: number | null;
  schoolName: string | null;

  gender: 'Male' | 'Female' | null;
  branchId: number | null;
  branchName: string | null;
  boardMediumId: number | null;
  boardMediumName: string | null;
}

export interface StudentDetails extends Student {
  enrollmentNumber: string;

  academicYearId: number;
  academicYearName: string;

  classId: number;
  className: string;

  sectionId: number;
  sectionName: string;
}

export interface CreateStudentRequest {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  alternatePhone?: string | null;
  address?: string | null;

  academicYearId: number;
  classId: number;
  sectionId: number;

  schoolId: number | null;

  gender: 'Male' | 'Female' | null;
  branchId: number | null;
  boardMediumId: number | null;

  discountType: 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;

  schoolPerformanceRecords?: CreateInitialStudentSchoolPerformanceRequest[];
}

export interface CreateInitialStudentSchoolPerformanceRequest {
  examName: string;
  examDate: string | null;
  maximumMarks: number;
  obtainedMarks: number;
}

export interface CreateStudentSchoolPerformanceRequest {
  schoolId: number;
  examName: string;
  examDate: string | null;
  maximumMarks: number;
  obtainedMarks: number;
}

export interface UpdateStudentRequest {
  rollNumber: string;
  name: string;
  email: string;
  phone?: string | null;
  alternatePhone?: string | null;
  address?: string | null;

  academicYearId: number;
  classId: number;
  sectionId: number;

  schoolId: number | null;

  gender: 'Male' | 'Female' | null;
  branchId: number | null;
  boardMediumId: number | null;
}
