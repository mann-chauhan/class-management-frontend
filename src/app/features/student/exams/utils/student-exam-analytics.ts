import {
  StudentExamMarkStatus,
  StudentExamResult
} from '../models/student-exam.model';

export const STUDENT_MARK_STATUSES: readonly StudentExamMarkStatus[] = [
  'SCORED',
  'PENDING',
  'ABSENT',
  'EXEMPT',
  'NOT_APPLICABLE'
];

export interface StudentSubjectAverage {
  subjectKey: string;
  subjectName: string;
  subjectCode: string;
  averagePercentage: number;
  obtainedMarks: number;
  maximumMarks: number;
}

export interface StudentSubjectResultGroup {
  subjectKey: string;
  subjectName: string;
  subjectCode: string;
  averagePercentage: number | null;
  obtainedMarks: number;
  maximumMarks: number;
  results: StudentExamResult[];
}

export interface StudentMarksAnalytics {
  eligibleScoredResults: StudentExamResult[];
  overallAveragePercentage: number | null;
  subjectAverages: StudentSubjectAverage[];
  subjectGroups: StudentSubjectResultGroup[];
  statusBreakdown: { status: StudentExamMarkStatus; count: number }[];
}

export function isEligibleScoredResult(result: StudentExamResult): boolean {
  return result.markStatus === 'SCORED'
    && typeof result.score === 'number'
    && Number.isFinite(result.score)
    && typeof result.maximumMarks === 'number'
    && Number.isFinite(result.maximumMarks)
    && result.maximumMarks > 0;
}

export function buildStudentMarksAnalytics(results: StudentExamResult[]): StudentMarksAnalytics {
  const marks = results ?? [];
  const eligibleScoredResults = marks.filter(isEligibleScoredResult);
  const obtainedMarks = eligibleScoredResults.reduce((total, result) => total + result.score!, 0);
  const maximumMarks = eligibleScoredResults.reduce((total, result) => total + result.maximumMarks, 0);
  const subjectGroups = buildSubjectGroups(marks);

  return {
    eligibleScoredResults,
    overallAveragePercentage: maximumMarks > 0
      ? (obtainedMarks / maximumMarks) * 100
      : null,
    subjectAverages: subjectGroups
      .filter((group): group is StudentSubjectResultGroup & { averagePercentage: number } =>
        group.averagePercentage !== null
      )
      .map(group => ({
        subjectKey: group.subjectKey,
        subjectName: group.subjectName,
        subjectCode: group.subjectCode,
        averagePercentage: group.averagePercentage,
        obtainedMarks: group.obtainedMarks,
        maximumMarks: group.maximumMarks
      })),
    subjectGroups,
    statusBreakdown: STUDENT_MARK_STATUSES.map(status => ({
      status,
      count: marks.filter(result => result.markStatus === status).length
    }))
  };
}

function buildSubjectGroups(results: StudentExamResult[]): StudentSubjectResultGroup[] {
  const groups = new Map<string, StudentSubjectResultGroup>();

  results.forEach(result => {
    const subjectKey = subjectKeyFor(result);
    const existing = groups.get(subjectKey);
    if (existing) {
      existing.results.push(result);
      return;
    }

    groups.set(subjectKey, {
      subjectKey,
      subjectName: result.subjectName,
      subjectCode: result.subjectCode,
      averagePercentage: null,
      obtainedMarks: 0,
      maximumMarks: 0,
      results: [result]
    });
  });

  return [...groups.values()]
    .map(group => {
      const eligibleResults = group.results.filter(isEligibleScoredResult);
      const obtainedMarks = eligibleResults.reduce((total, result) => total + result.score!, 0);
      const maximumMarks = eligibleResults.reduce((total, result) => total + result.maximumMarks, 0);

      return {
        ...group,
        averagePercentage: maximumMarks > 0 ? (obtainedMarks / maximumMarks) * 100 : null,
        obtainedMarks,
        maximumMarks,
        results: [...group.results].sort(compareExamResults)
      };
    })
    .sort((a, b) => {
      if (a.averagePercentage === null && b.averagePercentage !== null) return 1;
      if (a.averagePercentage !== null && b.averagePercentage === null) return -1;
      if (a.averagePercentage !== null && b.averagePercentage !== null &&
          a.averagePercentage !== b.averagePercentage) {
        return b.averagePercentage - a.averagePercentage;
      }
      return a.subjectName.localeCompare(b.subjectName);
    });
}

function subjectKeyFor(result: StudentExamResult): string {
  return (result.subjectCode?.trim() || result.subjectName.trim()).toLowerCase();
}

function compareExamResults(a: StudentExamResult, b: StudentExamResult): number {
  const dateDifference = new Date(b.examDate).getTime() - new Date(a.examDate).getTime();
  if (Number.isFinite(dateDifference) && dateDifference !== 0) return dateDifference;
  return a.title.localeCompare(b.title);
}
