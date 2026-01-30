import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeStore } from '../../../store/theme.store';

@Component({
  selector: 'app-theme-toggle-button',
  templateUrl: './theme-toggle-button.component.html',
  imports:[CommonModule]
})
export class ThemeToggleButtonComponent {
  
  themeStore = inject(ThemeStore);
  theme = this.themeStore.theme

  constructor() {}

  toggleTheme() {
    this.themeStore.toggleTheme();
  }
}