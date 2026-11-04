import { Routes } from '@angular/router';
import { DashboardLayoutComponent, NavItem } from '../../layout/dashboard-layout.component';

export const CANDIDATE_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'bi-speedometer2', link: '/candidate', exact: true },
  { label: 'My profile', icon: 'bi-person-badge', link: '/candidate/profile' },
  { label: 'Resumes', icon: 'bi-file-earmark-person', link: '/candidate/resumes' },
  { label: 'Available jobs', icon: 'bi-search', link: '/candidate/jobs' },
  { label: 'My applications', icon: 'bi-clipboard-check', link: '/candidate/applications' },
  { label: 'Interviews', icon: 'bi-calendar2-event', link: '/candidate/interviews' },
  { label: 'Notifications', icon: 'bi-bell', link: '/candidate/notifications' },
  { label: 'Settings', icon: 'bi-gear', link: '/candidate/settings' },
];

export default [
  {
    path: '',
    component: DashboardLayoutComponent,
    data: { areaLabel: 'Candidate', nav: CANDIDATE_NAV },
    children: [
      { path: '', title: 'Dashboard | Veejee Services', loadComponent: () => import('./candidate-dashboard.component') },
      { path: 'profile', title: 'My profile | Veejee Services', loadComponent: () => import('./profile-editor.component') },
      { path: 'resumes', title: 'Resumes | Veejee Services', loadComponent: () => import('./resumes.component') },
      { path: 'jobs', title: 'Available jobs | Veejee Services', loadComponent: () => import('./available-jobs.component') },
      { path: 'saved-jobs', title: 'Saved jobs | Veejee Services', loadComponent: () => import('./saved-jobs.component') },
      { path: 'applications', title: 'My applications | Veejee Services', loadComponent: () => import('./applications.component') },
      { path: 'applications/:id', title: 'Application | Veejee Services', loadComponent: () => import('./application-detail.component') },
      { path: 'interviews', title: 'Interview schedule | Veejee Services', loadComponent: () => import('./interviews.component') },
      { path: 'notifications', title: 'Notifications | Veejee Services', loadComponent: () => import('../notifications/notifications.component') },
      { path: 'settings', title: 'Account settings | Veejee Services', loadComponent: () => import('../account/settings.component') },
    ],
  },
] satisfies Routes;
