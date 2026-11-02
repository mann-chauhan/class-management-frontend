import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { TokenService } from '../auth/token.service';
import { APP_CONSTANTS } from '../constants/app.constants';

export const authGuard: CanActivateFn = () => {


    // Development mode: bypass authentication

    if (APP_CONSTANTS.DEV_BYPASS_GUARDS) {

        return true;

    }

    const tokenService = inject(TokenService);
    const router = inject(Router);

    if (tokenService.hasToken()) {
        console.log('✅ AUTHENTICATED');
           return true;
    }

    console.log('❌ NOT AUTHENTICATED');

    return router.createUrlTree(['/login']);
};
