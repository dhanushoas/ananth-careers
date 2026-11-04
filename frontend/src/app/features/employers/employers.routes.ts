import { Routes } from '@angular/router';

export default [
  { path: '', title: 'Our Client Companies | Veejee Services', loadComponent: () => import('./employers-list.component') },
  { path: ':slug', loadComponent: () => import('./employer-profile.component') },
] satisfies Routes;
