import { Component, inject, OnInit } from '@angular/core';
import { AuthStore } from '../auth.store';
import { Router } from '@angular/router';

@Component({
  selector: 'app-logout',
  imports: [],
  templateUrl: './logout.html',
  styleUrl: './logout.css',
})
export class Logout implements OnInit {
  authStore = inject(AuthStore);
  router = inject(Router);

  ngOnInit(): void {
    this.authStore.logout();
    setTimeout(() => {
      this.router.navigateByUrl('/');
    }, 2000);
  }
}
