import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackdropComponent } from '../backdrop/backdrop.component';
import { RouterModule } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { SidebarStore } from '../../store/sidebar.store';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';

@Component({
  selector: 'app-layout',
  imports: [
    CommonModule,
    RouterModule,
    AppHeaderComponent,
    BackdropComponent,
    AppSidebarComponent,
  ],
  templateUrl: './app-layout.component.html',
})

export class AppLayoutComponent {

  sidebarStore = inject(SidebarStore);

  readonly isExpanded = this.sidebarStore.isExpanded;
  readonly isHovered = this.sidebarStore.isHovered;
  readonly isMobileOpen = this.sidebarStore.isMobileOpen;

  constructor() {}

  get containerClasses() {
    return [
      'flex-1',
      'transition-all',
      'duration-300',
      'ease-in-out',
      (this.isExpanded() || this.isHovered()) ? 'xl:ml-[290px]' : 'xl:ml-[90px]',
      this.isMobileOpen() ? 'ml-0' : ''
    ];
  }

}
