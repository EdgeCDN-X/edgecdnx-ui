import { Component } from '@angular/core';
import { ComponentCardComponent } from '../../../common/component-card/component-card.component';

@Component({
  selector: 'app-toggle-switch',
  imports: [
    ComponentCardComponent,
  ],
  templateUrl: './toggle-switch.component.html',
  styles: ``
})
export class ToggleSwitchComponent {

  handleSwitchChange(checked: boolean) {
    console.log('Switch is now:', checked ? 'ON' : 'OFF');
  }
}
