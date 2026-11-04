import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup } from '@angular/forms';
import { buildJobQuery, parseCsv } from '../../features/jobs/job-search.component';
import { safeReturnUrl } from '../../features/auth/login.component';
import { friendlyMessage, toAppError } from '../../core/http/api-error';
import { toHttpParams } from '../../core/http/api.service';
import { EMPLOYMENT_TYPES } from '../../core/models';
import { timeAgo } from '../pipes/time-ago.pipe';
import { enumLabel } from '../pipes/enum-label.pipe';
import { applyServerErrors, linesToList, minMaxValidator, mobileValidator, urlValidator } from './form-utils';
import { filenameFromDisposition } from './download';
import { industryIcon } from './industry-icons';
import { biIcon } from '../ui/icons';

describe('utilities', () => {
  it('buildJobQuery parses query params safely', () => {
    const q = buildJobQuery({
      q: '  nurse ',
      employmentType: 'full_time,bogus,part_time',
      workMode: 'remote',
      experience: '2',
      salaryMin: '-5',
      sort: 'nope',
      page: '3',
    });
    expect(q.q).toBe('nurse');
    expect(q.employmentType).toEqual(['full_time', 'part_time']);
    expect(q.workMode).toEqual(['remote']);
    expect(q.experience).toBe(2);
    expect(q.salaryMin).toBeUndefined();
    expect(q.sort).toBeUndefined();
    expect(q.page).toBe(3);
    expect(parseCsv(undefined, EMPLOYMENT_TYPES)).toEqual([]);
  });

  it('safeReturnUrl blocks open redirects', () => {
    expect(safeReturnUrl('/seeker/applications')).toBe('/seeker/applications');
    expect(safeReturnUrl('//evil.com')).toBeNull();
    expect(safeReturnUrl('https://evil.com')).toBeNull();
    expect(safeReturnUrl('/auth/login')).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });

  it('toAppError normalises envelopes, bare statuses and wrapped resource errors', () => {
    const body = { success: false, message: 'Job already closed', errorCode: 'INVALID_STATE', details: [] };
    const err = new HttpErrorResponse({ status: 409, error: body });
    expect(toAppError(err)).toEqual({ status: 409, errorCode: 'INVALID_STATE', message: 'Job already closed', details: [] });
    expect(friendlyMessage(toAppError(err))).toBe('Job already closed');

    const locked = toAppError(new HttpErrorResponse({ status: 423, error: { errorCode: 'ACCOUNT_LOCKED', message: 'x' } }));
    expect(friendlyMessage(locked)).toContain('locked for 15 minutes');

    expect(toAppError(new HttpErrorResponse({ status: 0 })).errorCode).toBe('NETWORK_ERROR');
    const wrapped = new Error('wrapped', { cause: new HttpErrorResponse({ status: 404 }) });
    expect(toAppError(wrapped).errorCode).toBe('NOT_FOUND');
  });

  it('toHttpParams drops empty values and joins arrays', () => {
    const p = toHttpParams({ a: '', b: null, c: undefined, d: [], e: ['x', 'y'], f: 0, g: false });
    expect(p.keys().sort()).toEqual(['e', 'f', 'g']);
    expect(p.get('e')).toBe('x,y');
    expect(p.get('f')).toBe('0');
  });

  it('form validators', () => {
    expect(mobileValidator(new FormControl('98765 43210'))).toBeNull();
    expect(mobileValidator(new FormControl('abc'))).toEqual({ mobile: true });
    expect(urlValidator(new FormControl('https://veejee.example'))).toBeNull();
    expect(urlValidator(new FormControl('javascript:alert(1)'))).toEqual({ url: true });
    const g = new FormGroup({ min: new FormControl(5), max: new FormControl(2) });
    expect(minMaxValidator('min', 'max')(g)).toEqual({ minGreaterThanMax: true });
    expect(linesToList('- one\n\n• two\n three ')).toEqual(['one', 'two', 'three']);
  });

  it('applyServerErrors maps details to controls and returns the rest', () => {
    const g = new FormGroup({ email: new FormControl('') });
    const rest = applyServerErrors(g, {
      status: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'bad',
      details: [
        { field: 'email', message: 'Taken' },
        { field: 'unknown', message: 'Other problem' },
      ],
    });
    expect(g.controls.email.getError('server')).toBe('Taken');
    expect(rest).toEqual(['Other problem']);
  });

  it('timeAgo, enumLabel, filename parsing and industry icons', () => {
    const now = new Date('2026-11-04T10:00:00Z');
    expect(timeAgo('2026-11-04T09:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-11-04T07:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-11-06T10:00:00Z', now)).toBe('in 2 days');
    expect(enumLabel('interview_scheduled')).toBe('Interview scheduled');
    expect(enumLabel('some_new_value')).toBe('Some new value');
    expect(filenameFromDisposition('attachment; filename="cv.pdf"', 'x.pdf')).toBe('cv.pdf');
    expect(filenameFromDisposition("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf", 'x.pdf')).toBe('résumé.pdf');
    expect(filenameFromDisposition(null, 'x.pdf')).toBe('x.pdf');
    expect(industryIcon({ icon: 'terminal', slug: 'it-software', name: 'IT & Software' })).toBe('bi-terminal');
    expect(industryIcon({ icon: '<script>', slug: 'healthcare-medical', name: 'Healthcare & Medical' })).toBe('bi-heart-pulse');
    expect(industryIcon({ slug: 'food-hospitality', name: 'Food & Hospitality' })).toBe('bi-cup-hot');
    expect(biIcon('precision_manufacturing')).toBe('bi-gear-wide-connected');
    expect(biIcon('bi-truck')).toBe('bi-truck');
    expect(biIcon('unknown_icon')).toBe('bi-briefcase');
    expect(industryIcon({ slug: 'other', name: 'Other' })).toBe('bi-briefcase');
  });
});
