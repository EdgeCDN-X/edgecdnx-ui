import { Component, effect, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/components/ui/button/button.component';
import { ProjectsStore } from '../../store/projects.store';
import { CreateProjectDto } from '../../store/projects.types';

@Component({
  selector: 'app-create-project',
  imports: [ReactiveFormsModule, ButtonComponent],
  templateUrl: './create-project.html',
  styleUrl: './create-project.css',
})
export class CreateProject implements OnInit {
  @Output() onProjectCreated = new EventEmitter<void>();

  projectsStore = inject(ProjectsStore);

  // Create
  creating = this.projectsStore.creating;
  created = this.projectsStore.created;
  error = this.projectsStore.error;

  // TODO: allow longer names once done on backend
  createProjectForm = new FormGroup({
    name: new FormControl(
      "",
      {
        nonNullable: true,
        validators: [
          Validators.minLength(3),
          Validators.maxLength(63),
          Validators.required,
          (control) => {
            const value = control.value;
            // Must start with a letter, allow only letters, numbers, and spaces
            const regex = /^[a-zA-Z][a-zA-Z0-9 ]*$/;
            return regex.test(value)
              ? null
              : { invalidName: 'Name must start with a letter and contain only letters, numbers, and spaces.' };
          }
        ]
      }
    ),
    description: new FormControl(
      "",
      {
        nonNullable: true,
        validators: [Validators.maxLength(255)]
      }
    ),
  })

  ngOnInit(): void {
    this.projectsStore.clearCreationState();
  }

  createProject() {
    if (this.createProjectForm.valid) {
      this.projectsStore.createProject(this.createProjectForm.value as CreateProjectDto);
    }
  }

  constructor() {
    effect(() => {
      if (this.created() !== null) {
        this.onProjectCreated.emit();
      }
    })
  }
}
