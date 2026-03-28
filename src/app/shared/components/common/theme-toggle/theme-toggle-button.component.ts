import { Component, inject } from '@angular/core';

import { ThemeStore } from '../../../store/theme.store';

@Component({
  selector: 'app-theme-toggle-button',
  templateUrl: './theme-toggle-button.component.html',
  imports: []
})
export class ThemeToggleButtonComponent {
  
  themeStore = inject(ThemeStore);
  theme = this.themeStore.theme

  constructor() {}

  toggleTheme() {
    this.themeStore.toggleTheme();
  }
}