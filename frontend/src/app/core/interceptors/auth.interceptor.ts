import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SKIP_AUTH_RETRY } from '../http/http-context';

function isApiRequest(url: string): boolean {
  return url.startsWith(environment.apiUrl) || url.startsWith(`${location.origin}${environment.apiUrl}`);
}

function isAuthPath(url: string): boolean {
  return url.includes(`${environment.apiUrl}/auth/`);
}

function isTokenlessEndpoint(url: string): boolean {
  return /\/auth\/(refresh|login)$/.test(url.split('?')[0]);
}

function isTokenExpired(error: HttpErrorResponse): boolean {
  if (error.status !== 401) {
    return false;
  }
  const body: unknown = error.error;
  if (body instanceof Blob) {
    // Binary requests cannot expose the JSON body synchronously; treat 401 as expiry.
    return true;
  }
  return (
    typeof body === 'object' && body !== null && (body as { errorCode?: unknown }).errorCode === 'TOKEN_EXPIRED'
  );
}

function withBearer<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token && !isTokenlessEndpoint(req.url) ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * - Adds `X-Requested-With: XMLHttpRequest` to every API call (CSRF defence for cookie endpoints).
 * - Sends cookies (`withCredentials`) for `/auth/*` so the refresh cookie travels.
 * - Attaches the in-memory access token as a Bearer header.
 * - On `401 TOKEN_EXPIRED` performs a single-flight refresh and retries the request once.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);

  const prepared = req.clone({
    setHeaders: { 'X-Requested-With': 'XMLHttpRequest' },
    withCredentials: isAuthPath(req.url) || req.withCredentials,
  });
  const sentToken = auth.accessToken();

  return next(withBearer(prepared, sentToken)).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        req.context.get(SKIP_AUTH_RETRY) ||
        isTokenlessEndpoint(req.url) ||
        !sentToken ||
        !isTokenExpired(error)
      ) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        catchError(() => {
          const returnUrl = router.url;
          void router.navigate(['/auth/login'], {
            queryParams: returnUrl && !returnUrl.startsWith('/auth') ? { returnUrl } : {},
          });
          return throwError(() => error);
        }),
        switchMap((res) => next(withBearer(prepared, res.accessToken))),
      );
    }),
  );
};
