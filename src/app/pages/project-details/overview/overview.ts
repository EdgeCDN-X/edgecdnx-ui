import { Component, computed, inject } from '@angular/core';
import { ServiceList } from '../components/service-list/service-list';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Members } from '../components/members/members';
import { Roles } from '../components/roles/roles';
import { ZoneList } from '../components/zone-list/zone-list';
import { ProjectsStore } from '../../projects/store/projects.store';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [ServiceList, Members, Roles, ZoneList],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview {
  projectsStore = inject(ProjectsStore);
  route = inject(ActivatedRoute);

  projectId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('name')))
  )

  project = computed(() => {
    const name = this.projectId();
    return name ? this.projectsStore.projects().find(p => p.metadata.name === name) : undefined;
  })
}
