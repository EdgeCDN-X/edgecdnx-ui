import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarStore } from '../../store/sidebar.store';

@Component({
  selector: 'app-backdrop',
  imports: [
    CommonModule,
  ],
  templateUrl: './backdrop.component.html',
})

export class BackdropComponent {
  sidebarStore = inject(SidebarStore);
  readonly isMobileOpen = this.sidebarStore.isMobileOpen;

  constructor() {}

  closeSidebar() {
    this.sidebarStore.setMobileOpen(false);
  }
}
