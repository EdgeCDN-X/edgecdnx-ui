import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ServiceList } from '../components/service-list/service-list';
import { ProjectsStore } from '../../projects/store/projects.store';

@Component({
  selector: 'app-services',
  imports: [ServiceList],
  standalone: true,
  templateUrl: './services.html',
  styleUrl: './services.css',
})
export class Services {
  projectsStore = inject(ProjectsStore);
  route = inject(ActivatedRoute);

  project = computed(() => {
    const name = this.route.parent?.snapshot.paramMap.get('name');;
    return name ? this.projectsStore.projects().find(p => p.metadata.name === name) : undefined;
  })
}
