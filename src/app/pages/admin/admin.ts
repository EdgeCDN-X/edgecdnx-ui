import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';

@Component({
  selector: 'app-admin',
  imports: [RouterModule, PageBreadcrumbComponent],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {}
