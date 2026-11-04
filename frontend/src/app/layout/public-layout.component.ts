import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header.component';
import { FooterComponent } from './footer.component';

@Component({
  selector: 'app-public-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <a class="skip-link" href="#main">Skip to main content</a>
    <app-header />
    <main id="main" tabindex="-1" class="main"><router-outlet /></main>
    <app-footer />
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
    .main { flex: 1 0 auto; outline: none; }
  `,
})
export class PublicLayoutComponent {}
