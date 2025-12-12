import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OAuthService } from 'angular-oauth2-oidc';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  userInfo: any = null;

  constructor(private oauthService: OAuthService, private router: Router) {}

  ngOnInit(): void {
    this.userInfo = this.oauthService.getIdentityClaims();
  }

  logout(): void {
    this.oauthService.logOut();
    this.router.navigate(['/logout']);
  }
}
