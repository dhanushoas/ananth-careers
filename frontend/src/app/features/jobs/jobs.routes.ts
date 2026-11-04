import { Routes } from '@angular/router';

export default [
  { path: '', title: 'Job opportunities | Veejee Services', loadComponent: () => import('./job-search.component') },
  { path: ':slug', loadComponent: () => import('./job-details.component') },
] satisfies Routes;
