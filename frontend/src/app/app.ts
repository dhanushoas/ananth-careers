import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastStackComponent } from './shared/ui/toast-stack.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastStackComponent],
  template: `<router-outlet /><app-toast-stack />`,
})
export class App {}
