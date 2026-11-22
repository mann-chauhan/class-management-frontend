export type MeetingType = 'PARENT' | 'TEACHER';
export type MeetingAudienceMode = 'CRITERIA' | 'INDIVIDUAL_STUDENTS';
export type MeetingLifecycleStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type AttendanceSubmissionStatus = 'DRAFT' | 'SUBMITTED';
export type MeetingAttendanceStatus = 'PRESENT' | 'ABSENT';

export interface AttendanceSubmissionEligibility {
  available: boolean;
  eligibleAt: string;
  serverNow: string;
  timeZone: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
  code?: string | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface MeetingCriteria {
  meetingType: MeetingType;
  academicYearId?: number | null;
  classId?: number | null;
  sectionIds?: number[];
  schoolIds?: number[];
  branchIds?: number[];
  boardMediumIds?: number[];
  teacherIds?: number[];
}

export interface MeetingAudienceScope {
  academicYearId: number;
  classId: number;
  sectionIds: number[];
}

export interface MeetingStudentSelection {
  studentId: number;
  enrollmentId: number;
}

export interface MeetingAudienceEnrollment {
  enrollmentId: number;
  academicYearId: number;
  academicYearName: string;
  classId: number;
  className: string;
  sectionId: number | null;
  sectionName: string | null;
}

export interface MeetingAudienceStudent {
  studentId: number;
  name: string;
  rollNumber: string | null;
  eligibleEnrollments: MeetingAudienceEnrollment[];
}

export interface CriteriaAudience {
  audienceMode?: 'CRITERIA';
  academicYearId: number | null;
  classId: number | null;
  sectionIds: number[];
  schoolIds: number[];
  branchIds: number[];
  boardMediumIds: number[];
  teacherIds: number[];
}

export interface IndividualStudentsAudience {
  audienceMode: 'INDIVIDUAL_STUDENTS';
  scopes: MeetingAudienceScope[];
  studentSelections: MeetingStudentSelection[];
}

export type MeetingAudience = CriteriaAudience | IndividualStudentsAudience;

export interface Meeting {
  id: number;
  meetingType: MeetingType;
  title: string;
  description: string | null;
  meetingDate: string;
  startTime: string;
  endTime: string | null;
  venue: string;
  lifecycleStatus: MeetingLifecycleStatus;
  attendanceSubmissionStatus: AttendanceSubmissionStatus;
  audienceCriteria: MeetingCriteria;
  totalParticipants: number;
  presentCount: number;
  absentCount: number;
  unreviewedCount: number;
  attendancePercentage: number | null;
  version: number;
  submittedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  attendanceSubmissionEligibility: AttendanceSubmissionEligibility | null;
}

export interface MeetingSummary {
  totalMeetings: number;
  upcomingMeetings: number;
  completedMeetings: number;
  cancelledMeetings: number;
}

export interface AudiencePreviewRequest {
  meetingType: MeetingType;
  audience: MeetingAudience;
}

export interface AudiencePreviewResponse {
  meetingType: MeetingType;
  participantCount: number;
  empty: boolean;
  criteria: MeetingCriteria;
}

export interface CreateMeetingRequest {
  meetingType: MeetingType;
  title: string;
  description: string | null;
  meetingDate: string;
  startTime: string;
  endTime: string | null;
  venue: string;
  audience: MeetingAudience;
}

export interface AudienceStudentsSearchRequest {
  scopes: MeetingAudienceScope[];
  search: string;
  page: number;
  size: number;
}

export interface UpdateMeetingRequest {
  title: string;
  description: string | null;
  meetingDate: string;
  startTime: string;
  endTime: string | null;
  venue: string;
  expectedVersion: number;
}

export interface MeetingParticipant {
  id: number;
  displayName: string;
  identifier: string | null;
  academicYear: string | null;
  className: string | null;
  sectionName: string | null;
  schoolName: string | null;
  branchName: string | null;
  boardMediumName: string | null;
  attendanceStatus: MeetingAttendanceStatus;
  reviewed: boolean;
  version: number;
}

export interface AttendanceUpdateRequest {
  participantId: number;
  status: MeetingAttendanceStatus;
  expectedVersion: number;
}

export interface AttendanceBatchRequest {
  updates: AttendanceUpdateRequest[];
  expectedMeetingVersion: number;
}

export interface BulkAttendanceRequest {
  status: MeetingAttendanceStatus;
  expectedMeetingVersion: number;
}

export interface AttendanceOperationResponse {
  affectedParticipantCount: number;
  meeting: Meeting;
}
