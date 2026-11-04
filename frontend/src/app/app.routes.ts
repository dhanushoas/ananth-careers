import { Routes, UrlSegment } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout.component';
import { authGuard, recruiterPortalGuard, roleGuard } from './core/guards/guards';

/** Keeps old /seeker/* links (v1 emails, bookmarks) working. */
function seekerRedirect({ url }: { url: UrlSegment[] }): string {
  const rest = url.map((s) => s.path).join('/');
  return rest ? `/candidate/${rest}` : '/candidate';
}

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', title: 'Veejee Services – Your Recruitment Partner', loadComponent: () => import('./features/home/home.component') },
      { path: 'jobs', loadChildren: () => import('./features/jobs/jobs.routes') },
      { path: 'industries', loadChildren: () => import('./features/industries/industries.routes') },
      // Verified client companies (public directory).
      { path: 'employers', loadChildren: () => import('./features/employers/employers.routes') },
      {
        path: 'job-seekers',
        title: 'For Job Seekers | Veejee Services',
        data: { contentKey: 'job-seekers' },
        loadComponent: () => import('./features/static/audience-page.component'),
      },
      {
        path: 'for-employers',
        title: 'For Employers | Veejee Services',
        data: { contentKey: 'employers' },
        loadComponent: () => import('./features/static/audience-page.component'),
      },
      { path: 'employers-info', redirectTo: 'for-employers', pathMatch: 'full' },
      {
        path: 'process',
        title: 'How Our Recruitment Process Works | Veejee Services',
        loadComponent: () => import('./features/static/process-page.component'),
      },
      { path: 'recruiters', redirectTo: 'process', pathMatch: 'full' },
      { path: 'contact', title: 'Contact | Veejee Services', loadComponent: () => import('./features/contact/contact.component') },
      ...(['about', 'services', 'faq', 'privacy', 'terms', 'refund'] as const).map((key) => ({
        path: key,
        data: { contentKey: key },
        loadComponent: () => import('./features/static/content-page.component'),
      })),
      { path: 'auth', loadChildren: () => import('./features/auth/auth.routes') },
      {
        path: 'notifications',
        title: 'Notifications | Veejee Services',
        canActivate: [authGuard],
        loadComponent: () => import('./features/notifications/notifications.component'),
      },
      {
        path: 'forbidden',
        title: 'Access denied | Veejee Services',
        data: { kind: 'forbidden' },
        loadComponent: () => import('./features/errors/error-page.component'),
      },
      {
        path: 'error',
        title: 'Something went wrong | Veejee Services',
        data: { kind: 'error' },
        loadComponent: () => import('./features/errors/error-page.component'),
      },
    ],
  },
  { path: 'seeker', children: [{ path: '**', redirectTo: seekerRedirect }] },
  {
    path: 'candidate',
    canActivate: [roleGuard('candidate')],
    loadChildren: () => import('./features/candidate/candidate.routes'),
  },
  {
    path: 'employer',
    canActivate: [roleGuard('employer')],
    loadChildren: () => import('./features/employer/employer.routes'),
  },
  {
    // Veejee Services staff recruiters (and admins with `*` / `recruitment:manage`).
    path: 'recruiter',
    canActivate: [recruiterPortalGuard],
    loadChildren: () => import('./features/recruiter/recruiter.routes'),
  },
  {
    path: 'admin',
    canActivate: [roleGuard('admin')],
    loadChildren: () => import('./features/admin/admin.routes'),
  },
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '**',
        title: 'Page not found | Veejee Services',
        data: { kind: 'not-found' },
        loadComponent: () => import('./features/errors/error-page.component'),
      },
    ],
  },
];
