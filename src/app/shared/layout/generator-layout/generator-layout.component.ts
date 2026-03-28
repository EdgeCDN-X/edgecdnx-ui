
import { Component } from '@angular/core';

@Component({
  selector: 'app-generator-layout',
  imports: [],
  templateUrl: './generator-layout.component.html',
  styles: ``,
})
export class GeneratorLayoutComponent {
  sidebarOpen = true;

  closeSidebar = () => {
    this.sidebarOpen = false;
  };
}
