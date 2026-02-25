import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ProjectsStore } from './store/projects.store';
import { ModalComponent } from '../../shared/components/ui/modal/modal.component';
import { ModalStore } from '../../shared/store/modal.store';
import { RouterModule } from '@angular/router';
import { Placeholder } from '../../shared/components/common/placeholder/placeholder';
import { ButtonComponent } from '../../shared/components/ui/button/button.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { CreateProject } from './components/create-project/create-project';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, ModalComponent, RouterModule, Placeholder, ButtonComponent, PageBreadcrumbComponent, CreateProject],
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

  ngOnInit() {
    this.projectsStore.loadProjects();
  }

  closeModal() {
    this.modalStore.closeModal();
  }

  openModal() {
    this.modalStore.openModal();
  }

  onCreated() {
    setTimeout(() => {
      this.closeModal();
    }, 3000);
  }
}
