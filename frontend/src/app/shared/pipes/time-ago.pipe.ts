import { Pipe, PipeTransform } from '@angular/core';

export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return '';
  }
  const diffSec = Math.round((now.getTime() - time) / 1000);
  const future = diffSec < 0;
  const s = Math.abs(diffSec);
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, 'year'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ];
  if (s < 45) {
    return future ? 'in a moment' : 'just now';
  }
  for (const [size, label] of units) {
    if (s >= size) {
      const n = Math.floor(s / size);
      const text = `${n} ${label}${n === 1 ? '' : 's'}`;
      return future ? `in ${text}` : `${text} ago`;
    }
  }
  return future ? 'in a minute' : '1 minute ago';
}

/** "3 days ago" / "in 2 hours". Pure: re-evaluates when the input changes. */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return timeAgo(value);
  }
}
