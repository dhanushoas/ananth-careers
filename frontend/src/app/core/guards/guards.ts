import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Role } from '../models';

function loginTree(router: Router, returnUrl: string): UrlTree {
  return router.createUrlTree(['/auth/login'], { queryParams: returnUrl ? { returnUrl } : {} });
}

/** Requires an authenticated session. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : loginTree(router, state.url);
};

/** Requires an authenticated user with one of the given roles. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return loginTree(router, state.url);
    }
    const role = auth.role();
    return role && roles.includes(role) ? true : router.createUrlTree(['/forbidden']);
  };
}

/** Only for signed-out visitors (login/register); signed-in users go to their dashboard. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree([auth.homeUrl()]) : true;
};

/**
 * Requires an admin holding `permission` (or `*`). The permission may be passed directly or
 * read from `route.data.permission`.
 */
export function permissionGuard(permission?: string): CanActivateFn {
  return (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return loginTree(router, state.url);
    }
    const required = permission ?? (route.data['permission'] as string | undefined);
    if (!required) {
      return auth.role() === 'admin' ? true : router.createUrlTree(['/forbidden']);
    }
    return auth.hasPermission(required) ? true : router.createUrlTree(['/forbidden']);
  };
}

/** canMatch variant used to pick role-specific route trees. */
export function roleMatch(...roles: Role[]): CanMatchFn {
  return () => {
    const role = inject(AuthService).role();
    return role !== null && roles.includes(role);
  };
}

/** Recruiter portal: Veejee Services recruiters, or admins holding `*` or `recruitment:manage`. */
export const recruiterPortalGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return loginTree(router, state.url);
  }
  return auth.canRecruit() ? true : router.createUrlTree(['/forbidden']);
};
