import { Routes } from '@angular/router';
import { DashboardLayoutComponent, DashboardLayoutData, NavItem } from '../../layout/dashboard-layout.component';
import { permissionGuard } from '../../core/guards/guards';

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'bi-speedometer2', link: '/admin', exact: true },
  { label: 'Candidates', icon: 'bi-person-vcard', link: '/admin/candidates', permission: 'recruitment:manage' },
  { label: 'Companies', icon: 'bi-building', link: '/admin/employers', permission: 'employers:verify' },
  { label: 'Recruiters', icon: 'bi-person-badge', link: '/admin/recruiters', permission: 'recruiters:manage' },
  { label: 'Requirements', icon: 'bi-clipboard-check', link: '/admin/jobs', permission: 'jobs:moderate' },
  { label: 'Shortlist approvals', icon: 'bi-patch-check', link: '/admin/shortlists', permission: 'shortlists:approve' },
  { label: 'Interviews', icon: 'bi-calendar2-event', link: '/admin/interviews', permission: 'recruitment:manage' },
  { label: 'Recruitment portal', icon: 'bi-person-workspace', link: '/recruiter', permission: 'recruitment:manage' },
  { label: 'Reports & analytics', icon: 'bi-graph-up-arrow', link: '/admin/reports', permission: 'reports:view' },
  { label: 'Users', icon: 'bi-people', link: '/admin/users', permission: 'users:manage' },
  { label: 'Admins', icon: 'bi-shield-lock', link: '/admin/admins', permission: 'admins:manage' },
  { label: 'Website content', icon: 'bi-pencil-square', link: '/admin/content', permission: 'content:manage' },
  { label: 'Testimonials', icon: 'bi-chat-quote', link: '/admin/testimonials', permission: 'content:manage' },
  { label: 'Industries & categories', icon: 'bi-grid', link: '/admin/taxonomy', permission: 'taxonomy:manage' },
  { label: 'Enquiries', icon: 'bi-envelope', link: '/admin/enquiries', permission: 'enquiries:manage' },
  { label: 'Email outbox', icon: 'bi-send', link: '/admin/emails', permission: 'emails:manage' },
  { label: 'Resumes', icon: 'bi-file-earmark-person', link: '/admin/resumes', permission: 'resumes:manage' },
  { label: 'Audit logs', icon: 'bi-clock-history', link: '/admin/audit-logs', permission: 'audit:view' },
  { label: 'System settings', icon: 'bi-sliders', link: '/admin/settings', permission: 'settings:manage' },
  { label: 'My account', icon: 'bi-gear', link: '/admin/account' },
];

const layoutData: DashboardLayoutData = { nav: ADMIN_NAV, areaLabel: 'Admin console', variant: 'admin' };

const T = (s: string): string => `${s} | Admin | Veejee Services`;

export default [
  {
    path: '',
    component: DashboardLayoutComponent,
    data: layoutData,
    children: [
      { path: '', title: T('Dashboard'), loadComponent: () => import('./admin-dashboard.component') },
      {
        path: 'candidates',
        title: T('Candidates'),
        canActivate: [permissionGuard('recruitment:manage')],
        loadComponent: () => import('../recruiter/candidates/candidate-search.component'),
      },
      {
        path: 'employers',
        title: T('Companies'),
        canActivate: [permissionGuard('employers:verify')],
        loadComponent: () => import('./admin-employers.component'),
      },
      {
        path: 'recruiters',
        title: T('Recruiter management'),
        canActivate: [permissionGuard('recruiters:manage')],
        loadComponent: () => import('./admin-recruiters.component'),
      },
      {
        path: 'jobs',
        title: T('Requirement moderation'),
        canActivate: [permissionGuard('jobs:moderate')],
        loadComponent: () => import('./admin-jobs.component'),
      },
      {
        path: 'shortlists',
        title: T('Shortlist approvals'),
        canActivate: [permissionGuard('shortlists:approve')],
        loadComponent: () => import('./admin-shortlists.component'),
      },
      {
        path: 'interviews',
        title: T('Interviews'),
        canActivate: [permissionGuard('recruitment:manage')],
        loadComponent: () => import('./admin-interviews.component'),
      },
      {
        path: 'reports',
        title: T('Reports & analytics'),
        canActivate: [permissionGuard('reports:view')],
        loadComponent: () => import('./admin-reports.component'),
      },
      {
        path: 'users',
        title: T('Users'),
        canActivate: [permissionGuard('users:manage')],
        loadComponent: () => import('./admin-users.component'),
      },
      {
        path: 'admins',
        title: T('Admins'),
        canActivate: [permissionGuard('admins:manage')],
        loadComponent: () => import('./admin-admins.component'),
      },
      {
        path: 'content',
        title: T('Website content'),
        canActivate: [permissionGuard('content:manage')],
        loadComponent: () => import('./admin-content.component'),
      },
      {
        path: 'testimonials',
        title: T('Testimonials'),
        canActivate: [permissionGuard('content:manage')],
        loadComponent: () => import('./admin-testimonials.component'),
      },
      {
        path: 'taxonomy',
        title: T('Industries & categories'),
        canActivate: [permissionGuard('taxonomy:manage')],
        loadComponent: () => import('./admin-taxonomy.component'),
      },
      {
        path: 'enquiries',
        title: T('Enquiries'),
        canActivate: [permissionGuard('enquiries:manage')],
        loadComponent: () => import('./admin-enquiries.component'),
      },
      {
        path: 'emails',
        title: T('Email outbox'),
        canActivate: [permissionGuard('emails:manage')],
        loadComponent: () => import('./admin-emails.component'),
      },
      {
        path: 'resumes',
        title: T('Resumes'),
        canActivate: [permissionGuard('resumes:manage')],
        loadComponent: () => import('./admin-resumes.component'),
      },
      {
        path: 'audit-logs',
        title: T('Audit logs'),
        canActivate: [permissionGuard('audit:view')],
        loadComponent: () => import('./admin-audit-logs.component'),
      },
      {
        path: 'settings',
        title: T('System settings'),
        canActivate: [permissionGuard('settings:manage')],
        loadComponent: () => import('./admin-system-settings.component'),
      },
      { path: 'account', title: T('My account'), loadComponent: () => import('../account/settings.component') },
    ],
  },
] satisfies Routes;
