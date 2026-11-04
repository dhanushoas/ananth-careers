import { Pipe, PipeTransform } from '@angular/core';

/**
 * Material Symbols name → Bootstrap Icons class. The API stores industry icons as Material
 * Symbols names, so this map is kept for translating data as well as legacy names.
 */
export const MATERIAL_TO_BI: Readonly<Record<string, string>> = {
  // industries
  terminal: 'bi-terminal',
  storefront: 'bi-shop',
  engineering: 'bi-cone-striped',
  construction: 'bi-cone-striped',
  restaurant: 'bi-cup-hot',
  precision_manufacturing: 'bi-gear-wide-connected',
  factory: 'bi-gear-wide-connected',
  account_balance: 'bi-bank',
  medical_services: 'bi-heart-pulse',
  local_hospital: 'bi-heart-pulse',
  local_shipping: 'bi-truck',
  support_agent: 'bi-headset',
  school: 'bi-mortarboard',
  rocket_launch: 'bi-rocket-takeoff',
  work: 'bi-briefcase',
  computer: 'bi-laptop',
  code: 'bi-code-slash',
  campaign: 'bi-megaphone',
  shopping_cart: 'bi-cart',
  hotel: 'bi-building',
  category: 'bi-grid',
  more_horiz: 'bi-three-dots',
  add_a_photo: 'bi-camera',
  add_photo_alternate: 'bi-image',
  upload_file: 'bi-file-earmark-arrow-up',
  description: 'bi-file-earmark-text',
  picture_as_pdf: 'bi-file-earmark-pdf',
};

/** Returns the Bootstrap Icons class (e.g. `bi-briefcase`) for a Material name or a bi name. */
export function biIcon(name: string | null | undefined, fallback = 'bi-briefcase'): string {
  if (!name) {
    return fallback;
  }
  if (name.startsWith('bi-')) {
    return /^bi-[a-z0-9-]+$/.test(name) ? name : fallback;
  }
  if (MATERIAL_TO_BI[name]) {
    return MATERIAL_TO_BI[name];
  }
  // Bootstrap Icons names are kebab-case; accept a bare bi name too (e.g. "briefcase").
  return /^[a-z0-9-]+$/.test(name) && !name.includes('_') ? `bi-${name}` : fallback;
}

/** `{{ 'terminal' | bi }}` → `bi-terminal` */
@Pipe({ name: 'bi' })
export class BiPipe implements PipeTransform {
  transform(name: string | null | undefined, fallback = 'bi-briefcase'): string {
    return biIcon(name, fallback);
  }
}
