import { Routes } from '@angular/router';
import { DashboardLayoutComponent, NavItem } from '../../layout/dashboard-layout.component';

export const RECRUITER_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'bi-speedometer2', link: '/recruiter', exact: true },
  { label: 'Candidate database', icon: 'bi-people', link: '/recruiter/candidates' },
  { label: 'Applications', icon: 'bi-inbox', link: '/recruiter/applications' },
  { label: 'Requirements', icon: 'bi-clipboard-check', link: '/recruiter/requirements' },
  { label: 'Company submissions', icon: 'bi-send-check', link: '/recruiter/submissions' },
  { label: 'Interviews', icon: 'bi-calendar2-event', link: '/recruiter/interviews' },
  { label: 'Pipeline', icon: 'bi-kanban', link: '/recruiter/pipeline' },
  { label: 'Notifications', icon: 'bi-bell', link: '/recruiter/notifications' },
  { label: 'Settings', icon: 'bi-gear', link: '/recruiter/settings' },
];

export default [
  {
    path: '',
    component: DashboardLayoutComponent,
    data: { areaLabel: 'Recruiter portal', nav: RECRUITER_NAV },
    children: [
      { path: '', title: 'Recruiter dashboard | Veejee Services', loadComponent: () => import('./dashboard/recruiter-dashboard.component') },
      { path: 'candidates', title: 'Candidate database | Veejee Services', loadComponent: () => import('./candidates/candidate-search.component') },
      { path: 'compare', title: 'Compare candidates | Veejee Services', loadComponent: () => import('./candidates/candidate-compare.component') },
      { path: 'candidates/:id', title: 'Candidate profile | Veejee Services', loadComponent: () => import('./candidates/candidate-review.component') },
      { path: 'applications', title: 'Applications | Veejee Services', loadComponent: () => import('./applications/applications-queue.component') },
      { path: 'pipeline', title: 'Recruitment pipeline | Veejee Services', loadComponent: () => import('./pipeline/pipeline-board.component') },
      { path: 'requirements', title: 'Requirements | Veejee Services', loadComponent: () => import('./requirements/requirements-list.component') },
      { path: 'requirements/:id', title: 'Requirement | Veejee Services', loadComponent: () => import('./requirements/requirement-detail.component') },
      { path: 'submissions', title: 'Company submissions | Veejee Services', loadComponent: () => import('./submissions/submissions-list.component') },
      { path: 'submissions/:id', title: 'Submission | Veejee Services', loadComponent: () => import('./submissions/submission-detail.component') },
      { path: 'interviews', title: 'Interview coordination | Veejee Services', loadComponent: () => import('./interviews/interviews.component') },
      { path: 'notifications', title: 'Notifications | Veejee Services', loadComponent: () => import('../notifications/notifications.component') },
      { path: 'settings', title: 'Account settings | Veejee Services', loadComponent: () => import('../account/settings.component') },
    ],
  },
] satisfies Routes;
