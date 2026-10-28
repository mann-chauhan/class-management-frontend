import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router
} from '@angular/router';

import { TokenService } from '../auth/token.service';
import { APP_CONSTANTS } from '../constants/app.constants';

export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
) => {

  // Development mode: bypass role restriction

  if (APP_CONSTANTS.DEV_BYPASS_GUARDS) {

    return true;

  }



  const tokenService = inject(TokenService);
  const router = inject(Router);

  // Get logged-in user's role
  const userRole = tokenService.getRole();


  // No role → access denied
  if (!userRole) {

    return router.createUrlTree(['/access-denied']);
  }

  // Get roles allowed for this route
  const allowedRoles = route.data['roles'] as string[] | undefined;


  // Route has no role restriction
  if (!allowedRoles || allowedRoles.length === 0) {

    return true;
  }

  // Check permission
  const hasPermission = allowedRoles.includes(userRole);

  if (hasPermission) {
    return true;
  }

  return router.createUrlTree(['/access-denied']);
};
