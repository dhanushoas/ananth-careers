import { Industry } from '../../core/models';
import { MATERIAL_TO_BI, biIcon } from '../ui/icons';

/** Keyword fallbacks (Bootstrap Icons) for the industries Veejee Services supports. */
const FALLBACKS: [RegExp, string][] = [
  [/(retail|marketing)/i, 'bi-shop'],
  [/(civil|construction)/i, 'bi-cone-striped'],
  [/(food|hospitality|hotel)/i, 'bi-cup-hot'],
  [/(manufactur|production)/i, 'bi-gear-wide-connected'],
  [/(bank|finance)/i, 'bi-bank'],
  [/(health|medical)/i, 'bi-heart-pulse'],
  [/(logistic|transport)/i, 'bi-truck'],
  [/(sales|customer|support)/i, 'bi-headset'],
  [/(education|admin)/i, 'bi-mortarboard'],
  [/(fresher|intern)/i, 'bi-rocket-takeoff'],
  [/(software|tech)/i, 'bi-terminal'],
];

/**
 * Bootstrap Icons class for an industry. The API stores a Material Symbols name in `icon`; known
 * names are mapped, otherwise a keyword match on the slug/name is used, falling back to a briefcase.
 */
export function industryIcon(industry: Pick<Industry, 'icon' | 'slug' | 'name'>): string {
  const icon = industry.icon?.trim();
  if (icon && (MATERIAL_TO_BI[icon] || /^bi-[a-z0-9-]+$/.test(icon))) {
    return biIcon(icon);
  }
  if (/\bit\b/i.test(industry.name) || /^it-/.test(industry.slug)) {
    return 'bi-terminal';
  }
  const key = `${industry.slug} ${industry.name}`;
  for (const [pattern, cls] of FALLBACKS) {
    if (pattern.test(key)) {
      return cls;
    }
  }
  return 'bi-briefcase';
}
