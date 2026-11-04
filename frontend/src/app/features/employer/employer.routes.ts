import { Routes } from '@angular/router';
import { DashboardLayoutComponent, NavItem } from '../../layout/dashboard-layout.component';
import { companyContextGuard } from './company-context.service';

export const EMPLOYER_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'bi-speedometer2', link: '/employer', exact: true },
  { label: 'Company profile', icon: 'bi-building', link: '/employer/company' },
  { label: 'Requirements', icon: 'bi-clipboard-check', link: '/employer/requirements', exact: true },
  { label: 'Post a requirement', icon: 'bi-plus-circle', link: '/employer/requirements/new' },
  { label: 'Submitted candidates', icon: 'bi-person-check', link: '/employer/candidates' },
  { label: 'Interviews', icon: 'bi-calendar2-event', link: '/employer/interviews' },
  { label: 'Recruitment history', icon: 'bi-clock-history', link: '/employer/history' },
  { label: 'Notifications', icon: 'bi-bell', link: '/employer/notifications' },
  { label: 'Settings', icon: 'bi-gear', link: '/employer/settings' },
];

export default [
  {
    path: '',
    component: DashboardLayoutComponent,
    canActivate: [companyContextGuard],
    data: { areaLabel: 'Employer', nav: EMPLOYER_NAV },
    children: [
      { path: '', title: 'Employer dashboard | Veejee Services', loadComponent: () => import('./employer-dashboard.component') },
      { path: 'company', title: 'Company profile | Veejee Services', loadComponent: () => import('./company-profile.component') },
      { path: 'requirements', title: 'Recruitment requirements | Veejee Services', loadComponent: () => import('./requirements-list.component') },
      { path: 'requirements/new', title: 'Post a requirement | Veejee Services', loadComponent: () => import('./job-form.component') },
      { path: 'requirements/:id/edit', title: 'Edit requirement | Veejee Services', loadComponent: () => import('./job-form.component') },
      { path: 'requirements/:id', title: 'Requirement | Veejee Services', loadComponent: () => import('./requirement-detail.component') },
      { path: 'candidates', title: 'Submitted candidates | Veejee Services', loadComponent: () => import('./submitted-candidates.component') },
      {
        path: 'candidates/:submissionId',
        title: 'Candidate details | Veejee Services',
        loadComponent: () => import('./candidate-detail.component'),
      },
      { path: 'interviews', title: 'Interviews | Veejee Services', loadComponent: () => import('./interviews.component') },
      { path: 'history', title: 'Recruitment history | Veejee Services', loadComponent: () => import('./history.component') },
      { path: 'notifications', title: 'Notifications | Veejee Services', loadComponent: () => import('../notifications/notifications.component') },
      { path: 'settings', title: 'Account settings | Veejee Services', loadComponent: () => import('../account/settings.component') },
      // v1 links
      { path: 'jobs', redirectTo: 'requirements', pathMatch: 'full' },
      { path: 'jobs/new', redirectTo: 'requirements/new', pathMatch: 'full' },
      { path: 'applications/:submissionId', redirectTo: 'candidates/:submissionId' },
    ],
  },
] satisfies Routes;
