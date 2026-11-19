import { permissionGuard } from './core/guards/permission.guard';
import { routes } from './app.routes';

describe('teacher student routes', () => {
  const applicationRoutes = routes.find(route => route.path === '')?.children ?? [];

  it('protects student list, create and edit routes with their prerequisites', () => {
    const listRoute = applicationRoutes.find(route => route.path === 'teacher/students');
    const createRoute = applicationRoutes.find(route => route.path === 'teacher/students/create');
    const editRoute = applicationRoutes.find(route => route.path === 'teacher/students/:id/edit');

    expect(listRoute?.canActivate).toContain(permissionGuard);
    expect(listRoute?.data?.['permissions']).toEqual(['STUDENT_VIEW_NAME']);
    expect(createRoute?.canActivate).toContain(permissionGuard);
    expect(createRoute?.data?.['roles']).toEqual(['TEACHER']);
    expect(createRoute?.data?.['permissions']).toEqual([
      'STUDENT_VIEW_NAME',
      'STUDENT_CREATE'
    ]);
    expect(editRoute?.canActivate).toContain(permissionGuard);
    expect(editRoute?.data?.['roles']).toEqual(['TEACHER']);
    expect(editRoute?.data?.['permissions']).toEqual(['STUDENT_VIEW_NAME']);
  });
});

describe('teacher assignment routes', () => {
  const applicationRoutes = routes.find(route => route.path === '')?.children ?? [];

  it('protects the list and edit routes with ASSIGNMENT_VIEW', () => {
    for (const path of ['teacher/assignments', 'teacher/assignments/:id/edit']) {
      const route = applicationRoutes.find(candidate => candidate.path === path);

      expect(route?.canActivate).toContain(permissionGuard);
      expect(route?.data?.['roles']).toEqual(['TEACHER']);
      expect(route?.data?.['permissions']).toEqual(['ASSIGNMENT_VIEW']);
    }
  });
});
