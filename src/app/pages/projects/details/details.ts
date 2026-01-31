import { Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ProjectsStore } from '../store/projects.store';
import { map } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { RbacRule, UserGroupMapping } from '../store/projects.types';

@Component({
  standalone: true,
  selector: 'app-project-details',
  imports: [DatePipe, CommonModule, Placeholder],
  templateUrl: './details.html',
  styleUrl: './details.css',
})
export class ProjectDetails implements OnInit {
  projectsStore = inject(ProjectsStore);
  route = inject(ActivatedRoute);

  projectId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('name')))
  )

  loaded = this.projectsStore.loaded;
  loading = this.projectsStore.loading;
  error = this.projectsStore.error;

  groups = computed<UserGroupMapping[]>(() => {
    return this.project()?.spec.rbac.groups.filter((group, index, self) =>
      index === self.findIndex((g) => (
        g.v1 === group.v1
      ))
    ).map((g) => g.v1).map((gName) => {
      const users = this.project()?.spec.rbac.groups.filter(gr => gr.v1 === gName).map(gr => gr.v0) || [];
      return {
        groupName: gName,
        users: users
      };
    }) || [];
  })

  roles = computed<RbacRule[]>(() => {
    return this.project()?.spec.rbac.rules.filter((role, index, self) => index === self.findIndex((r) => r.v0 == role.v0)).map((r) => r.v0).map((role) => {
      const rules = this.project()?.spec.rbac.rules.filter(rr => rr.v0 === role).map((rr) => { return { resource: rr.v2, action: rr.v3 } }) || [];
      return {
        role: role,
        rules: rules
      };
    }) || [];
  })

  project = computed(() => {
    const name = this.projectId();
    return name ? this.projectsStore.projects().find(p => p.metadata.name === name) : undefined;
  })

  constructor() { }

  ngOnInit() {
    if (!this.loaded()) {
      this.projectsStore.loadProjects();
    }
  }
}
