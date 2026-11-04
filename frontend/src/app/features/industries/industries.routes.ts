import { Routes } from '@angular/router';

export default [
  { path: '', title: 'Industries We Serve | Veejee Services', loadComponent: () => import('./industries-list.component') },
  { path: ':slug', loadComponent: () => import('./industry-detail.component') },
] satisfies Routes;
