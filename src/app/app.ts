import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from './auth/auth.config';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {

  constructor(private oauthService: OAuthService) { }

  ngOnInit(): void {
    // this.oauthService.configure(authConfig);
    // this.oauthService.loadDiscoveryDocumentAndLogin().then((loaded) => {
    //   console.log('Discovery document loaded:', loaded);
    //   if (this.oauthService.hasValidAccessToken()) {
    //     console.log('User is authenticated');
    //   } else {
    //     console.log('User is not authenticated');
    //   }
    // });
  }
}
