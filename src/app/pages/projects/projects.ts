import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit } from '@angular/core';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ProjectsStore } from './store/projects.store';
import { ModalComponent } from '../../shared/components/ui/modal/modal.component';
import { ModalStore } from '../../shared/store/modal.store';
import { InputFieldComponent } from '../../shared/components/form/input/input-field.component';
import { LabelComponent } from '../../shared/components/form/label/label.component';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateProjectDto } from './store/projects.types';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, PageBreadcrumbComponent, ModalComponent, ReactiveFormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class Projects implements OnInit {
  modalStore = inject(ModalStore);

  isOpen = this.modalStore.isOpen;

  // Load
  projectsStore = inject(ProjectsStore);
  projects = this.projectsStore.projects;
  loading = this.projectsStore.loading;
  error = this.projectsStore.error;

  // Create
  creating = this.projectsStore.creating;
  created = this.projectsStore.created;

  // TODO: allow longer names once done on backend
  createProjectForm = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.minLength(3), Validators.maxLength(30), Validators.required] }),
    description: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(255)] }),
  })

  ngOnInit() {
    this.projectsStore.loadProjects();


  }

  closeModal() {
    this.modalStore.closeModal();
  }

  openModal() {
    this.projectsStore.clearCreationState();
    this.createProjectForm.reset();
    this.modalStore.openModal();
  }

  createProject() {
    if (this.createProjectForm.valid) {
      this.projectsStore.createProject(this.createProjectForm.value as CreateProjectDto);
    }
  }

  constructor() {
    effect(() => {
      console.log("Created project:", this.created());
      if (this.created() !== null) {
        setTimeout(() => { this.closeModal() }, 3000);
      }
    })
  }
}
