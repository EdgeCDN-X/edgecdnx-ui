import { Component, computed, inject, Input } from '@angular/core';
import { ProjectsStore } from '../../../projects/store/projects.store';
import { RbacRule } from '../../../projects/store/projects.types';

@Component({
  selector: 'app-roles',
  imports: [],
  templateUrl: './roles.html',
  styleUrl: './roles.css',
})
export class Roles {

  @Input() projectId!: string;

  projectsStore = inject(ProjectsStore);

  project = computed(() => {
    const name = this.projectId;
    return name ? this.projectsStore.projects().find(p => p.metadata.name === name) : undefined;
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

}
