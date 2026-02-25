import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ZoneList } from '../components/zone-list/zone-list';
import { ProjectsStore } from '../../projects/store/projects.store';

@Component({
  selector: 'app-zones',
  imports: [CommonModule,  ZoneList],
  templateUrl: './zones.html',
  styleUrl: './zones.css',
})
export class Zones {
  projectStore = inject(ProjectsStore);
  route = inject(ActivatedRoute);

  project = computed(() => {
    const name = this.route.parent?.snapshot.paramMap.get('name');;
    return name ? this.projectStore.projects().find(p => p.metadata.name === name) : undefined;
  })
}
