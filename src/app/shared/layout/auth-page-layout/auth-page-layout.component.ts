import { Component } from '@angular/core';
import { GridShapeComponent } from '../../components/common/grid-shape/grid-shape.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-auth-page-layout',
  imports: [
    GridShapeComponent,
    RouterModule,
  ],
  templateUrl: './auth-page-layout.component.html',
  styles: ``
})
export class AuthPageLayoutComponent {

}
