import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthStore } from './auth/auth.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  authStore = inject(AuthStore);

  isAuthenticated = this.authStore.isAuthenticated;

  constructor() { }

  async ngOnInit(): Promise<void> {
    await this.authStore.runInitialLoginSequence();
  }
}
