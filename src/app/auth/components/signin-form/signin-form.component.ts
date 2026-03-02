
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { AuthStore } from '../../auth.store';
import { ConfigService } from '../../../config/config.store';

@Component({
  selector: 'app-signin-form',
  imports: [
    ButtonComponent,
    RouterModule,
    FormsModule
  ],
  templateUrl: './signin-form.component.html',
  styles: ``
})
export class SigninFormComponent {

  authStore = inject(AuthStore);
  router = inject(ActivatedRoute);
  config = inject(ConfigService);

  async onSignIn() {
    await this.authStore.login(this.router.snapshot.queryParams['redirectUrl']);
  }

  async onSignUp() {
    if (this.config.environment()?.auth.allowSignup) {
      await this.authStore.register(this.router.snapshot.queryParams['redirectUrl']);
    }
  }
}
