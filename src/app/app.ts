import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from './auth/auth.store';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
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
