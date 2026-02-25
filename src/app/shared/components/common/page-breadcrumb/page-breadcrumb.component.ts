import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';

export type BreadcrumbItem = {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-page-breadcrumb',
  imports: [
    RouterModule,
  ],
  templateUrl: './page-breadcrumb.component.html',
  styles: ``
})
export class PageBreadcrumbComponent {
  links = input<BreadcrumbItem[]>();
  pageTitle = input.required<string>();
}
