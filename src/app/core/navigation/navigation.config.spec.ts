import { NAVIGATION_CONFIG } from './navigation.config';

describe('NAVIGATION_CONFIG teacher permissions', () => {
  const teacherItems = () =>
    NAVIGATION_CONFIG['TEACHER'].flatMap(section => section.items);

  it('maps only the confirmed teacher navigation entries to permissions', () => {
    const permissionsByRoute = new Map(
      teacherItems().map(item => [item.route, item.requiredPermission])
    );

    expect(permissionsByRoute.get('/teacher/exams')).toBe('EXAM_VIEW');
    expect(permissionsByRoute.get('/teacher/assignments')).toBe('ASSIGNMENT_VIEW');
    expect(permissionsByRoute.get('/teacher/students')).toBe('STUDENT_VIEW_NAME');
    expect(permissionsByRoute.get('/teacher/attendance')).toBe('ATTENDANCE_VIEW');
    expect(permissionsByRoute.get('/teacher/leave/review')).toBe('LEAVE_STUDENT_VIEW');
  });

  it('keeps role-level teacher entries permission-free', () => {
    const permissionsByRoute = new Map(
      teacherItems().map(item => [item.route, item.requiredPermission])
    );

    expect(permissionsByRoute.get('/teacher/dashboard')).toBeUndefined();
    expect(permissionsByRoute.get('/teacher/leave')).toBeUndefined();
  });

  it('does not add permission metadata to non-teacher navigation', () => {
    const nonTeacherItems = [
      ...NAVIGATION_CONFIG['SUPER_ADMIN'].flatMap(section => section.items),
      ...NAVIGATION_CONFIG['ADMIN'].flatMap(section => section.items),
      ...NAVIGATION_CONFIG['STUDENT'].flatMap(section => section.items)
    ];

    expect(nonTeacherItems.every(item => !item.requiredPermission)).toBe(true);
  });
});

describe('NAVIGATION_CONFIG admin meetings', () => {
  it('contains one admin Meetings entry without inventing a permission', () => {
    const items = NAVIGATION_CONFIG['ADMIN'].flatMap(section => section.items)
      .filter(item => item.route === '/admin/meetings');

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Meetings');
    expect(items[0].requiredPermission).toBeUndefined();
  });
});
