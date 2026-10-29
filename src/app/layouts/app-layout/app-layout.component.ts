
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import { interval, Subscription } from 'rxjs';

import { ProfileComponent } from '../../features/profile/profile/profile';

import { TokenService } from '../../core/auth/token.service';
import { AuthStateService } from '../../core/auth/auth-state.service';

import {
  NAVIGATION_CONFIG,
  NavigationSection
} from '../../core/navigation/navigation.config';

import { GlobalSearchComponent } from '../../shared/components/global-search/global-search.component';
import { StudentOverviewWizardComponent } from '../../features/student/overview-wizard/student-overview-wizard.component';
import { StudentOverviewWizardStateService } from '../../core/services/student-overview-wizard-state.service';

import {
  ChangeDetectorRef,
  Component,
  HostListener,
  NgZone,
  OnDestroy
} from '@angular/core';

import {
  AbsentStudentNotification,
  PendingAttendanceNotification,
  PendingLeaveNotification
} from '../../core/models/notification.model';

import {
  NotificationService
} from '../../core/services/notification.service';



@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ProfileComponent,
    GlobalSearchComponent,
    StudentOverviewWizardComponent
  ],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss'
})
export class AppLayoutComponent implements OnDestroy {

  sidebarOpen = false;
  profileOpen = false;

  userName = 'User';
  userRole = 'User';
  userInitial = 'U';
  private notificationPollingSubscription?: Subscription;

private readonly notificationPollingInterval = 30_000;

  navigationSections: NavigationSection[] = [];
  
    // =====================================================
  // ADMIN NOTIFICATIONS
  // =====================================================

  absentNotifications: AbsentStudentNotification[] = [];
  absentNotificationLoading = false;
  absentNotificationError = '';

  pendingAttendanceNotifications: PendingAttendanceNotification[] = [];
  pendingAttendanceNotificationLoading = false;
  pendingAttendanceNotificationError = '';
  pendingLeaveNotifications: PendingLeaveNotification[] = [];
  pendingLeaveCount = 0;
  leaveNotificationLoading = false;
  leaveNotificationError = '';

  notificationCount = 0;

  notificationLoading = false;

  notificationError = '';

  activeNotificationTab: 'absent' | 'pending' | 'leave' = 'absent';

  notificationOpen = false;
  showStudentOverviewWizard = false;

 constructor(
  private readonly tokenService: TokenService,
  private readonly router: Router,
  private readonly authStateService: AuthStateService,
  private readonly studentOverviewWizardState: StudentOverviewWizardStateService,
  private readonly notificationService: NotificationService,
  private readonly ngZone: NgZone,
  private readonly cdr: ChangeDetectorRef
) {
  this.loadUserInformation();
  this.loadNavigation();
  this.loadAdminNotifications();
  this.showStudentOverviewWizard =
    this.studentOverviewWizardState.isRequiredFor(this.tokenService.getRole());

  if (this.userRole === 'Admin') {
    this.notificationPollingSubscription = interval(
      this.notificationPollingInterval
    ).subscribe(() => {
      this.loadAdminNotifications();
    });
  }
}

  onStudentOverviewWizardCompleted(): void {
    this.showStudentOverviewWizard = false;
    this.cdr.detectChanges();
  }


  // =====================================================
  // USER INFORMATION
  // =====================================================

  private loadUserInformation(): void {

    const role = this.tokenService.getRole();

    if (!role) {
      return;
    }

    this.userRole = this.formatRole(role);

    this.userName = this.formatRole(role);

    this.userInitial = this.userName.charAt(0).toUpperCase();
  }


  // =====================================================
  // ROLE BASED NAVIGATION
  // =====================================================

 private loadNavigation(): void {

  const role = this.tokenService.getRole();

  if (!role) {
    this.navigationSections = [];
    return;
  }

  this.navigationSections = NAVIGATION_CONFIG[role] ?? [];
}


  // =====================================================
  // ROLE FORMATTER
  // =====================================================

  private formatRole(role: string): string {

    return role
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }


  // =====================================================
  // SIDEBAR
  // =====================================================

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }


  closeSidebar(): void {
    this.sidebarOpen = false;
  }


  // =====================================================
  // LOGOUT
  // =====================================================

logout(): void {

  this.authStateService.logout().subscribe({
    next: () => {
      this.sidebarOpen = false;
      this.router.navigate(['/login']);
    },

    error: error => {
      console.error('Logout failed:', error);

      this.sidebarOpen = false;
      this.router.navigate(['/login']);
    }
  });
}

  goToProfile(): void {
    this.sidebarOpen = false;
    this.profileOpen = true;
  }

    // =====================================================
  // ADMIN NOTIFICATIONS
  // =====================================================

  private loadAdminNotifications(): void {
    if (this.userRole !== 'Admin') {
      return;
    }

    this.absentNotificationLoading = true;
    this.pendingAttendanceNotificationLoading = true;
    this.leaveNotificationLoading = true;
    this.updateNotificationState();

    this.notificationService.getTodayAbsentStudents().subscribe({
      next: response => {
        this.ngZone.run(() => {
          this.absentNotifications = response.data ?? [];
          this.absentNotificationLoading = false;
          this.absentNotificationError = '';
          this.recalculateNotificationCount();
          this.updateNotificationState();
          this.cdr.detectChanges();
        });
      },
      error: error => {
        console.error('Failed to load absent student notifications:', error);

        this.ngZone.run(() => {
          this.absentNotificationLoading = false;
          this.absentNotificationError =
            error?.error?.message || 'Unable to load absent student notifications.';
          this.updateNotificationState();
          this.cdr.detectChanges();
        });
      }
    });

    this.notificationService.getPendingAttendance().subscribe({
      next: response => {
        this.ngZone.run(() => {
          this.pendingAttendanceNotifications = response.data ?? [];
          this.pendingAttendanceNotificationLoading = false;
          this.pendingAttendanceNotificationError = '';
          this.recalculateNotificationCount();
          this.updateNotificationState();
          this.cdr.detectChanges();
        });
      },
      error: error => {
        console.error('Failed to load pending attendance notifications:', error);

        this.ngZone.run(() => {
          this.pendingAttendanceNotificationLoading = false;
          this.pendingAttendanceNotificationError =
            error?.error?.message || 'Unable to load pending attendance notifications.';
          this.updateNotificationState();
          this.cdr.detectChanges();
        });
      }
    });

    this.notificationService.getPendingLeaveRequests().subscribe({
      next: response => {
        this.ngZone.run(() => {
          this.pendingLeaveNotifications = response.data?.content ?? [];
          this.pendingLeaveCount = response.data?.totalElements ?? 0;
          this.leaveNotificationLoading = false;
          this.leaveNotificationError = '';
          this.recalculateNotificationCount();
          this.updateNotificationState();
          this.cdr.detectChanges();
        });
      },
      error: error => {
        console.error('Failed to load pending leave notifications:', error);

        this.ngZone.run(() => {
          this.leaveNotificationLoading = false;
          this.leaveNotificationError =
            error?.error?.message || 'Unable to load leave notifications.';
          this.updateNotificationState();
          this.cdr.detectChanges();
        });
      }
    });
  }

  private recalculateNotificationCount(): void {
    this.notificationCount =
      this.absentNotifications.length +
      this.pendingAttendanceNotifications.length +
      this.pendingLeaveCount;
  }

  private updateNotificationState(): void {
    this.notificationLoading =
      this.absentNotificationLoading ||
      this.pendingAttendanceNotificationLoading ||
      this.leaveNotificationLoading;

    const allCategoriesFailed =
      Boolean(this.absentNotificationError) &&
      Boolean(this.pendingAttendanceNotificationError) &&
      Boolean(this.leaveNotificationError);

    this.notificationError = allCategoriesFailed
      ? 'Unable to load notifications.'
      : '';
  }

  ngOnDestroy(): void {
    if (this.notificationPollingSubscription) {
      this.notificationPollingSubscription.unsubscribe();
    }
  }

  toggleNotifications(): void {

    this.notificationOpen =
      !this.notificationOpen;

    if (this.notificationOpen) {
      this.loadAdminNotifications();
    }
  }


  closeNotifications(): void {
    this.notificationOpen = false;
  }


  goToAttendance(): void {

    this.notificationOpen = false;

    this.router.navigate([
      '/admin/attendance'
    ]);
  }

  goToLeave(): void { this.notificationOpen = false; this.router.navigate(['/admin/leave']); }

  @HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent): void {
  if (!this.notificationOpen) {
    return;
  }

  const target = event.target as HTMLElement | null;

  if (!target) {
    return;
  }

  const clickedInsideNotification =
    target.closest('.header-notification') !== null ||
    target.closest('.notification-dropdown') !== null;

  if (!clickedInsideNotification) {
    this.notificationOpen = false;
  }
}

  setNotificationTab(tab: 'absent' | 'pending' | 'leave'): void {
  this.activeNotificationTab = tab;
}
}
