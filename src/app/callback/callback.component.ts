import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OAuthService } from 'angular-oauth2-oidc';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <div class="callback-message">
        <p>Completing authentication...</p>
      </div>
    </div>
  `,
  styles: [
    `
      .callback-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background: #f5f5f5;
      }
      .callback-message {
        text-align: center;
        color: #666;
      }
    `,
  ],
})
export class CallbackComponent implements OnInit {
  constructor(private oauthService: OAuthService, private router: Router) {}

  ngOnInit(): void {
    // The OAuth service will handle the callback automatically
    // After successful authentication, redirect to dashboard
    this.oauthService
      .loadDiscoveryDocumentAndTryLogin()
      .then(() => {
        if (this.oauthService.hasValidAccessToken()) {
          this.router.navigate(['/']);
        } else {
          // If authentication failed, redirect to login
          this.router.navigate(['/login']);
        }
      })
      .catch(() => {
        // On error, redirect to login
        this.router.navigate(['/login']);
      });
  }
}
