import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guards';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Sign in | Veejee Services',
    canActivate: [guestGuard],
    loadComponent: () => import('./login.component'),
  },
  {
    path: 'register',
    title: 'Create an account | Veejee Services',
    canActivate: [guestGuard],
    loadComponent: () => import('./register-choice.component'),
  },
  {
    path: 'register/candidate',
    title: 'Candidate registration | Veejee Services',
    canActivate: [guestGuard],
    loadComponent: () => import('./register-candidate.component'),
  },
  { path: 'register/jobseeker', redirectTo: 'register/candidate', pathMatch: 'full' },
  {
    path: 'register/employer',
    title: 'Company registration | Veejee Services',
    canActivate: [guestGuard],
    loadComponent: () => import('./register-employer.component'),
  },
  {
    path: 'google-complete',
    title: 'Finish creating your account | Veejee Services',
    canActivate: [guestGuard],
    loadComponent: () => import('./google-complete.component'),
  },
  { path: 'verify-email', title: 'Verify email | Veejee Services', loadComponent: () => import('./verify-email.component') },
  {
    path: 'forgot-password',
    title: 'Forgot password | Veejee Services',
    loadComponent: () => import('./forgot-password.component'),
  },
  {
    path: 'reset-password',
    title: 'Reset password | Veejee Services',
    data: { mode: 'reset' },
    loadComponent: () => import('./set-password.component'),
  },
  {
    path: 'accept-invite',
    title: 'Accept invitation | Veejee Services',
    data: { mode: 'invite' },
    loadComponent: () => import('./set-password.component'),
  },
] satisfies Routes;
