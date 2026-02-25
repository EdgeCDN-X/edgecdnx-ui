import { Component, computed, inject, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProjectsStore } from '../../../projects/store/projects.store';
import { UserGroupMapping } from '../../../projects/store/projects.types';

@Component({
  selector: 'app-members',
  imports: [],
  templateUrl: './members.html',
  styleUrl: './members.css',
})
export class Members {

  @Input() projectId!: string;

  projectsStore = inject(ProjectsStore);
  route = inject(ActivatedRoute);

  project = computed(() => {
    const name = this.projectId;
    return name ? this.projectsStore.projects().find(p => p.metadata.name === name) : undefined;
  })

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
}
