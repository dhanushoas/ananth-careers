import { biIcon } from '../../shared/ui/icons';

/** Material Symbols names used by CMS content (process / audience pages) → Bootstrap Icons. */
const CONTENT_ICONS: Readonly<Record<string, string>> = {
  person_add: 'bi-person-plus',
  fact_check: 'bi-clipboard-check',
  filter_alt: 'bi-funnel',
  send: 'bi-send-check',
  groups: 'bi-people',
  emoji_events: 'bi-trophy',
  verified_user: 'bi-shield-check',
  lock: 'bi-shield-lock',
  track_changes: 'bi-activity',
  support_agent: 'bi-headset',
  speed: 'bi-speedometer2',
  event_available: 'bi-calendar2-check',
  insights: 'bi-graph-up',
  handshake: 'bi-hand-thumbs-up',
  work: 'bi-briefcase',
  search: 'bi-search',
  description: 'bi-file-earmark-text',
  badge: 'bi-person-vcard',
  star: 'bi-star',
};

/** Bootstrap icon class for a content icon (bi name, known Material name, or fallback). */
export function contentIcon(name: string | null | undefined, fallback = 'bi-check2-circle'): string {
  if (name && CONTENT_ICONS[name]) {
    return CONTENT_ICONS[name];
  }
  return biIcon(name, fallback);
}
