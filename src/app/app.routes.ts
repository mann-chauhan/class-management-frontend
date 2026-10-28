import { Routes } from '@angular/router';

// AUTH
import { LoginComponent } from './features/auth/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';

// LAYOUT
import { AppLayoutComponent } from './layouts/app-layout/app-layout.component';

// ERROR PAGES
import { AccessDeniedComponent } from './features/errors/access-denied/access-denied.component';
import { NotFoundComponent } from './features/errors/not-found/not-found.component';
import { ServerErrorComponent } from './features/errors/server-error/server-error.component';

// SUPER ADMIN
import { SuperAdminDashboard } from './features/super-admin/dashboard/super-admin-dashboard/super-admin-dashboard';
import { AdminListComponent } from './features/super-admin/admins/admin-list/admin-list';
import { AdminCreateComponent } from './features/super-admin/admins/admin-create/admin-create';
import { AdminEditComponent } from './features/super-admin/admins/admin-edit/admin-edit';
import { AdminDetailsComponent } from './features/super-admin/admins/admin-details/admin-details';

// ADMIN
import { AdminDashboard } from './features/admin/dashboard/admin-dashboard/admin-dashboard';
import { StudentsInsider } from './features/admin/insider/students-insider/students-insider';
import { FeesInsider } from './features/admin/insider/fees-insider/fees-insider';

import { AcademicYearsComponent } from './features/admin/academic/academic-years/academic-years';
import { ClassesComponent } from './features/admin/academic/classes/classes';
import { SubjectsComponent } from './features/admin/academic/subjects/subjects';
import { SchoolComponent } from './features/admin/academic/schools/school';

import { TeacherList } from './features/admin/teachers/teacher-list/teacher-list';
import { TeacherDetails } from './features/admin/teachers/teacher-details/teacher-details';
import { TeacherForm } from './features/admin/teachers/teacher-form/teacher-form';


import { StudentForm } from './features/admin/students/student-form/student-form';

import { TeacherRoleList } from './features/admin/teacher-roles/teacher-role-list/teacher-role-list';
import { TeacherRoleForm } from './features/admin/teacher-roles/teacher-role-form/teacher-role-form';

import { TeacherRoleAssignmentList } from './features/admin/teacher-role-assignments/teacher-role-assignment-list/teacher-role-assignment-list';
import { TeacherRoleAssignmentForm } from './features/admin/teacher-role-assignments/teacher-role-assignment-form/teacher-role-assignment-form';
import { TeacherRoleAssignmentView } from './features/admin/teacher-role-assignments/teacher-role-assignment-view/teacher-role-assignment-view';

import { AssignmentList } from './features/admin/assignments/assignment-list/assignment-list';
import { AssignmentForm } from './features/admin/assignments/assignment-form/assignment-form';

import { AttendanceOverview } from './features/admin/attendance/attendance-overview/attendance-overview';

import { TeacherAssignmentList as AdminTeacherAssignmentList } from './features/admin/teacher-assignments/teacher-assignment-list/teacher-assignment-list';
import { TeacherAssignmentForm as AdminTeacherAssignmentForm } from './features/admin/teacher-assignments/teacher-assignment-form/teacher-assignment-form';
import { TeacherAssignmentView as AdminTeacherAssignmentView } from './features/admin/teacher-assignments/teacher-assignment-view/teacher-assignment-view';
import { StudentWorkspace } from './features/admin/students/student-workspace/student-workspace';
import { AcademicWorkspaceComponent } from './features/admin/academic/academic-workspace/academic-workspace';
import { TeacherManagementComponent } from './features/admin/teachers/teacher-management/teacher-management';



// FEES
import { FeeStructureList } from './features/admin/fees/fee-structure-list/fee-structure-list';
import { FeeStructureCreateComponent } from './features/admin/fees/fee-structure-create/fee-structure-create';
import { FeeStructureEdit } from './features/admin/fees/fee-structure-edit/fee-structure-edit';
import { StudentFeeList } from './features/admin/fees/student-fee-list/student-fee-list';
import { StudentFeeView } from './features/admin/fees/student-fee-view/student-fee-view';
import { AddPayment } from './features/admin/fees/add-payment/add-payment';
import { ReceiptSettingsComponent } from './features/admin/fees/receipt-settings/receipt-settings';
import { ReceiptListComponent } from './features/admin/fees/receipt-list/receipt-list';
import { ReceiptViewComponent } from './features/admin/fees/receipt-view/receipt-view';


// TEACHER
import { TeacherDashboard } from './features/teacher/dashboard/teacher-dashboard/teacher-dashboard';

import { TeacherAssignmentList } from './features/teacher/assignments/teacher-assignment-list/teacher-assignment-list';
import { TeacherAssignmentForm } from './features/teacher/assignments/teacher-assignment-form/teacher-assignment-form';

import { TeacherStudentListComponent } from './features/teacher/students/components/teacher-student-list/teacher-student-list';
import { TeacherStudentFormComponent } from './features/teacher/students/components/teacher-student-form/teacher-student-form';

import { TeacherAttendanceComponent } from './features/teacher/attendance/teacher-attendance/teacher-attendance';
import { MarkAttendanceComponent } from './features/teacher/attendance/mark-attendance/mark-attendance';
import { EditAttendanceComponent } from './features/teacher/attendance/edit-attendance/edit-attendance';
import { TeacherAssignmentManager } from './features/admin/teacher-assignments/teacher-assignment-manager/teacher-assignment-manager';

// STUDENT
import { StudentDashboard } from './features/student/dashboard/student-dashboard/student-dashboard';
import { StudentAttendanceComponent } from './features/student/attendance/student-attendance/student-attendance';
import { StudentFeesComponent } from './features/student/fees/fees';
import { StudentAssignmentsComponent } from './features/student/assignments/student-assignments/student-assignments';
import { StudentExamResultsComponent } from './features/student/exams/student-exam-results/student-exam-results';
import { FeeManagementComponent } from './features/admin/fees/fee-management/fee-management';

export const routes: Routes = [

  // =========================================================
  // PUBLIC
  // =========================================================

  {
    path: 'login',
    component: LoginComponent
  },

  {
  path: 'forgot-password',
  component: ForgotPasswordComponent
  },
  {
  path: 'reset-password',
  component: ResetPasswordComponent
},

  {
    path: 'access-denied',
    component: AccessDeniedComponent
  },

  {
    path: 'not-found',
    component: NotFoundComponent
  },

  {
    path: 'server-error',
    component: ServerErrorComponent
  },

  // =========================================================
  // AUTHENTICATED APPLICATION
  // =========================================================

  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],

    children: [

      // =====================================================
      // SUPER ADMIN
      // =====================================================

      {
        path: 'super-admin/dashboard',
        component: SuperAdminDashboard,
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN'] }
      },

      {
        path: 'super-admin/admins',
        component: AdminListComponent,
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN'] }
      },

      {
        path: 'super-admin/admins/create',
        component: AdminCreateComponent,
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN'] }
      },

      {
        path: 'super-admin/admins/:id/edit',
        component: AdminEditComponent,
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN'] }
      },

      {
        path: 'super-admin/admins/:id/details',
        component: AdminDetailsComponent,
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN'] }
      },

      // =====================================================
      // ADMIN
      // =====================================================

      {
        path: 'admin/dashboard',
        component: AdminDashboard,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'admin/leave',
        loadComponent: () => import('./features/leave/admin-leave-management/admin-leave-management.component').then(m => m.AdminLeaveManagementComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/advertisements/create',
        loadComponent: () => import('./features/admin/advertisements/advertisement-form/advertisement-form')
          .then(m => m.AdvertisementFormComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/advertisements/settings',
        loadComponent: () => import('./features/admin/advertisements/advertisement-settings/advertisement-settings')
          .then(m => m.AdvertisementSettingsComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/advertisements/:id/edit',
        loadComponent: () => import('./features/admin/advertisements/advertisement-form/advertisement-form')
          .then(m => m.AdvertisementFormComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/advertisements',
        loadComponent: () => import('./features/admin/advertisements/advertisement-list/advertisement-list')
          .then(m => m.AdvertisementListComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      // --------------------- ACADEMIC ----------------------

      {
        path: 'admin/academic',
        component: AcademicWorkspaceComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      // --------------------- TEACHERS -----------------------

      {
        path: 'admin/teachers',
        component: TeacherManagementComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teachers/create',
        component: TeacherForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teachers/:id/edit',
        component: TeacherForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teachers/:id',
        component: TeacherDetails,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      // --------------------- STUDENTS ----------------------

{
  path: 'admin/students',
  loadComponent: () =>
    import('./features/admin/students/student-list/student-list')
      .then(m => m.StudentList),
  canActivate: [roleGuard],
  data: { roles: ['ADMIN'] }
},

      {
        path: 'admin/students/create',
        component: StudentForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/students/:id',
        component: StudentWorkspace,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/students/:id/edit',
        component: StudentForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      // ------------------- TEACHER ROLES --------------------

      {
        path: 'admin/teacher-roles',
        component: TeacherRoleList,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teacher-roles/create',
        component: TeacherRoleForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teacher-roles/:id/edit',
        component: TeacherRoleForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      // ------------ TEACHER ROLE ASSIGNMENTS ---------------

      {
        path: 'admin/teacher-role-assignments',
        component: TeacherRoleAssignmentList,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teacher-role-assignments/create',
        component: TeacherRoleAssignmentForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teacher-role-assignments/:teacherId/view',
        component: TeacherRoleAssignmentView,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teacher-role-assignments/:teacherId/edit',
        component: TeacherRoleAssignmentForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      // teacher assignments
      {
        path: 'admin/teacher-assignments',
        component: AdminTeacherAssignmentList,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'admin/teacher-assignments/create',
        component: AdminTeacherAssignmentForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teacher-assignments/manage/:teacherId/:academicYearId',
        component: TeacherAssignmentManager,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/teacher-assignments/:id/view',
        component: AdminTeacherAssignmentView,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'admin/teacher-assignments/:id/edit',
        component: AdminTeacherAssignmentForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      // -------------------- EXAMS --------------------
      {
        path: 'admin/exams/create',
        loadComponent: () => import('./features/exams/exam-form/exam-form')
          .then(m => m.ExamFormComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'], examRole: 'ADMIN' }
      },
      {
        path: 'admin/exams/:id/marks',
        loadComponent: () => import('./features/exams/marks-entry/marks-entry')
          .then(m => m.MarksEntryComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'], examRole: 'ADMIN' }
      },
      {
        path: 'admin/exams/:id/edit',
        loadComponent: () => import('./features/exams/exam-form/exam-form')
          .then(m => m.ExamFormComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'], examRole: 'ADMIN' }
      },
      {
        path: 'admin/exams',
        loadComponent: () => import('./features/exams/exam-list/exam-list')
          .then(m => m.ExamListComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'], examRole: 'ADMIN' }
      },

      // -------------------- ASSIGNMENTS --------------------

      {
        path: 'admin/assignments',
        component: AssignmentList,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/assignments/create',
        component: AssignmentForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/assignments/:id/edit',
        component: AssignmentForm,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      // -------------------- ATTENDANCE ---------------------

      {
        path: 'admin/attendance',
        component: AttendanceOverview,
        canActivate: [roleGuard],
        data: {
          roles: ['ADMIN'],
          title: 'Attendance',
          description: 'Manage attendance.'
        }
      },

      // =====================================================
      // ADMIN FEES
      // =====================================================

      {
        path: 'admin/fees',
        component: FeeManagementComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/fee-structures',
        component: FeeStructureList,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/fee-structures/create',
        component: FeeStructureCreateComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/fee-structures/:id/edit',
        component: FeeStructureEdit,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/student-fees',
        component: StudentFeeList,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/student-fees/:id/payment',
        component: AddPayment,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/student-fees/:id/receipts',
        component: ReceiptListComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/student-fees/:id/edit',
        component: StudentFeeView,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/student-fees/:id',
        component: StudentFeeView,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/receipts/:id',
        component: ReceiptViewComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees/receipt-settings',
        component: ReceiptSettingsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/insider/students',
        component: StudentsInsider,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'admin/fees-insider',
        component: FeesInsider,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      // =====================================================
      // TEACHER
      // =====================================================

      {
        path: 'teacher/dashboard',
        component: TeacherDashboard,
        canActivate: [roleGuard],
        data: { roles: ['TEACHER'] }
      },

      // -------------------- EXAMS --------------------
      {
        path: 'teacher/exams/create',
        loadComponent: () => import('./features/exams/exam-form/exam-form')
          .then(m => m.ExamFormComponent),
        canActivate: [roleGuard, permissionGuard],
        data: {
          roles: ['TEACHER'],
          permissions: ['EXAM_VIEW', 'EXAM_CREATE'],
          examRole: 'TEACHER'
        }
      },
      {
        path: 'teacher/exams/:id/marks',
        loadComponent: () => import('./features/exams/marks-entry/marks-entry')
          .then(m => m.MarksEntryComponent),
        canActivate: [roleGuard, permissionGuard],
        data: {
          roles: ['TEACHER'],
          permissions: ['EXAM_VIEW', 'EXAM_MARKS_MANAGE'],
          examRole: 'TEACHER'
        }
      },
      {
        path: 'teacher/exams/:id/edit',
        loadComponent: () => import('./features/exams/exam-form/exam-form')
          .then(m => m.ExamFormComponent),
        canActivate: [roleGuard, permissionGuard],
        data: {
          roles: ['TEACHER'],
          permissions: ['EXAM_VIEW', 'EXAM_EDIT'],
          examRole: 'TEACHER'
        }
      },
      {
        path: 'teacher/exams',
        loadComponent: () => import('./features/exams/exam-list/exam-list')
          .then(m => m.ExamListComponent),
        canActivate: [roleGuard, permissionGuard],
        data: {
          roles: ['TEACHER'],
          permissions: ['EXAM_VIEW'],
          examRole: 'TEACHER'
        }
      },

      // -------------------- ASSIGNMENTS --------------------

      {
        path: 'teacher/assignments',
        component: TeacherAssignmentList,
        canActivate: [roleGuard],
        data: { roles: ['TEACHER'] }
      },

      {
        path: 'teacher/leave/review',
        loadComponent: () => import('./features/leave/teacher-leave-review/teacher-leave-review.component').then(m => m.TeacherLeaveReviewComponent),
        canActivate: [roleGuard, permissionGuard],
        data: {
          roles: ['TEACHER'],
          permissions: ['LEAVE_STUDENT_VIEW']
        }
      },

      {
        path: 'teacher/leave',
        loadComponent: () => import('./features/leave/leave-management/leave-management.component').then(m => m.LeaveManagementComponent),
        canActivate: [roleGuard],
        data: { roles: ['TEACHER'] }
      },

      {
        path: 'teacher/assignments/:id/edit',
        component: TeacherAssignmentForm,
        canActivate: [roleGuard],
        data: { roles: ['TEACHER'] }
      },

      // -------------------- STUDENTS -----------------------

      {
        path: 'teacher/students',
        component: TeacherStudentListComponent,
        canActivate: [roleGuard],
        data: { roles: ['TEACHER'] }
      },

      {
        path: 'teacher/students/create',
        component: TeacherStudentFormComponent,
        canActivate: [roleGuard],
        data: { roles: ['TEACHER'] }
      },

      {
        path: 'teacher/students/:id/edit',
        component: TeacherStudentFormComponent,
        canActivate: [roleGuard],
        data: { roles: ['TEACHER'] }
      },



      // -------------------- ATTENDANCE ---------------------

      {
        path: 'teacher/attendance',
        component: TeacherAttendanceComponent,
        canActivate: [
          roleGuard,
          permissionGuard
        ],
        data: {
          roles: ['TEACHER'],
          permissions: ['ATTENDANCE_VIEW']
        }
      },

      {
        path: 'teacher/attendance/mark',
        component: MarkAttendanceComponent,
        canActivate: [
          roleGuard,
          permissionGuard
        ],
        data: {
          roles: ['TEACHER'],
          permissions: ['ATTENDANCE_MARK']
        }
      },

      {
        path: 'teacher/attendance/edit/:id',
        component: EditAttendanceComponent,
        canActivate: [
          roleGuard,
          permissionGuard
        ],
        data: {
          roles: ['TEACHER'],
          permissions: ['ATTENDANCE_EDIT']
        }
      },

      // =====================================================
      // STUDENT
      // =====================================================

      {
        path: 'student/dashboard',
        component: StudentDashboard,
        canActivate: [roleGuard],
        data: { roles: ['STUDENT'] }
      },

      {
        path: 'student/fees',
        component: StudentFeesComponent,
        canActivate: [roleGuard],
        data: { roles: ['STUDENT'] }
      },

      {
        path: 'student/attendance',
        component: StudentAttendanceComponent,
        canActivate: [roleGuard],
        data: {
          roles: ['STUDENT'],
          title: 'My Attendance',
          description: 'View attendance records.'
        }
      },

      {
        path: 'student/assignments',
        component: StudentAssignmentsComponent,
        canActivate: [roleGuard],
        data: {
          roles: ['STUDENT'],
          title: 'Assignments',
          description: 'View your assignments and deadlines.'
        }
      },

      {
        path: 'student/exams',
        component: StudentExamResultsComponent,
        canActivate: [roleGuard],
        data: {
          roles: ['STUDENT'],
          title: 'Exam Results',
          description: 'View your published exams and marks.'
        }
      },
      {
        path: 'student/leave',
        loadComponent: () => import('./features/leave/leave-management/leave-management.component').then(m => m.LeaveManagementComponent),
        canActivate: [roleGuard],
        data: { roles: ['STUDENT'] }
      }
    ]
  },

  // =========================================================
  // DEFAULT
  // =========================================================

  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // =========================================================
  // WILDCARD
  // =========================================================

  {
    path: '**',
    redirectTo: 'not-found'
  }


];
