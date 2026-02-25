
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { AuthStore } from '../../auth.store';

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

  async onSignIn() {
    await this.authStore.login(this.router.snapshot.queryParams['redirectUrl']);
  }
}
