import { Pipe, PipeTransform } from '@angular/core';
import { JobLocation } from '../../core/models';

/** "Bengaluru, Karnataka · Pune" — joins job locations compactly. */
@Pipe({ name: 'locations' })
export class LocationsPipe implements PipeTransform {
  transform(locations: JobLocation[] | null | undefined, max = 2): string {
    if (!locations || locations.length === 0) {
      return 'Location not specified';
    }
    const parts = locations.slice(0, max).map((l) => [l.city, l.state].filter(Boolean).join(', '));
    const extra = locations.length - max;
    return extra > 0 ? `${parts.join(' · ')} +${extra} more` : parts.join(' · ');
  }
}
