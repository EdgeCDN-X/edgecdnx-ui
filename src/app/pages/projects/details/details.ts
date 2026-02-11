import { Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProjectsStore } from '../store/projects.store';
import { map } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { RbacRule, UserGroupMapping } from '../store/projects.types';

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

  projectId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('name')))
  )

  loading = this.projectsStore.loading;
  error = this.projectsStore.error;


  project = computed(() => {
    const name = this.projectId();
    return name ? this.projectsStore.projects().find(p => p.metadata.name === name) : undefined;
  })

  constructor() { }

  ngOnInit() {
    this.projectsStore.loadProjects();
  }
}
