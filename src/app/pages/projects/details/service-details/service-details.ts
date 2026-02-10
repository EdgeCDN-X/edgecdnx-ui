import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map, of } from 'rxjs';
import { Placeholder } from '../../../../shared/components/common/placeholder/placeholder';
import { ServiceStore } from '../../store/service.store';
import { Service } from '../../store/service.types';

@Component({
  selector: 'app-service-details',
  imports: [CommonModule, Placeholder],
  templateUrl: './service-details.html',
  styleUrl: './service-details.css',
})
export class ServiceDetails {
  private route = inject(ActivatedRoute);
  private serviceStore = inject(ServiceStore);

  loading = this.serviceStore.loading;
  error = this.serviceStore.error;
  services = this.serviceStore.services;

  projectId = toSignal(
    this.route.parent?.paramMap.pipe(map(params => params.get('name'))) ?? of(null)
  );

  serviceName = toSignal(
    this.route.paramMap.pipe(map(params => params.get('serviceName')))
  );

  service = computed<Service | undefined>(() => {
    const list = this.services() as Service[] | null;
    const name = this.serviceName();
    if (!list || !name) {
      return undefined;
    }
    return list.find(item => item.spec?.name === name);
  });

  private visibleKeyIndexes = signal<Set<number>>(new Set());
  private clipboardClickedIndexers = signal<Set<number>>(new Set());

  isKeyVisible(index: number): boolean {
    return this.visibleKeyIndexes().has(index);
  }

  isClipboardClicked(index: number): boolean {
    return this.clipboardClickedIndexers().has(index);
  }

  toggleKeyVisibility(index: number): void {
    const next = new Set(this.visibleKeyIndexes());
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.visibleKeyIndexes.set(next);
  }

  copyKeyValue(index: number, value?: string | null): void {
    if (!value) {
      return;
    }
    navigator.clipboard?.writeText(value);
    const next = new Set(this.clipboardClickedIndexers());
    next.add(index);
    this.clipboardClickedIndexers.set(next);

    setTimeout(() => {
      const next = new Set(this.clipboardClickedIndexers());
      next.delete(index);
      this.clipboardClickedIndexers.set(next);
    }, 2000);
  }

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (projectId) {
        this.serviceStore.selectProject(projectId);
      }
    });
  }
}
