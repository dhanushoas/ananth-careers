import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { friendlyMessage, toAppError } from '../http/api-error';
import { SKIP_ERROR_TOAST } from '../http/http-context';
import { ToastService } from '../services/toast.service';

/** Blob error bodies (from binary downloads) are converted back to JSON when possible. */
function normaliseBlobError(error: HttpErrorResponse): Observable<HttpErrorResponse> {
  const blob = error.error as Blob;
  return from(
    blob
      .text()
      .then((text) => {
        try {
          return new HttpErrorResponse({
            error: JSON.parse(text) as unknown,
            headers: error.headers,
            status: error.status,
            statusText: error.statusText,
            url: error.url ?? undefined,
          });
        } catch {
          return error;
        }
      })
      .catch(() => error),
  );
}

/**
 * Shows a toast for failed API calls (unless the request opted out with SKIP_ERROR_TOAST)
 * and re-throws the error for local handling. Registered *outside* the auth interceptor so
 * that it only sees errors that survived the refresh-and-retry.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: unknown) => {
      const source$: Observable<unknown> =
        error instanceof HttpErrorResponse && error.error instanceof Blob
          ? normaliseBlobError(error)
          : from([error]);
      return source$.pipe(
        switchMap((normalised) => {
          if (!req.context.get(SKIP_ERROR_TOAST)) {
            toast.error(friendlyMessage(toAppError(normalised)));
          }
          return throwError(() => normalised);
        }),
      );
    }),
  );
};
