import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProjectsStore } from '../store/projects.store';
import { map } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { RbacRule, UserGroupMapping } from '../store/projects.types';
import { ServiceStore } from '../store/service.store';
import { ZoneStore } from '../store/zone.store';

@Component({
  standalone: true,
  selector: 'app-project-details',
  imports: [DatePipe, CommonModule, Placeholder, RouterModule],
  templateUrl: './details.html',
  styleUrl: './details.css',
})
export class ProjectDetails implements OnInit {
  projectsStore = inject(ProjectsStore);
  route = inject(ActivatedRoute);

  serviceStore = inject(ServiceStore);
  zoneStore = inject(ZoneStore);
  

  projectId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('name')))
  )

  loading = this.projectsStore.loading;
  error = this.projectsStore.error;


  project = computed(() => {
    const name = this.projectId();
    return name ? this.projectsStore.projects().find(p => p.metadata.name === name) : undefined;
  })

  constructor() { 
    effect(() => {
      if (this.project()) {
        this.projectsStore.selectProject(this.project()!.metadata.name);
        this.serviceStore.selectProject(this.project()!.metadata.name);
        this.zoneStore.selectProject(this.project()!.metadata.name);
      }
    })
  }

  ngOnInit() {
    this.projectsStore.loadProjects();
  }
}
