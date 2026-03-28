import { Component, inject } from '@angular/core';

import { SidebarStore } from '../../store/sidebar.store';

@Component({
  selector: 'app-backdrop',
  imports: [],
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
