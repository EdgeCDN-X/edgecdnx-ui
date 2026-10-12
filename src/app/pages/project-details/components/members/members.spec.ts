import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { MembersStore } from '../../../projects/store/members.store';
import { ProjectMember } from '../../../projects/store/members.types';
import { INVITE_NEW_USER, Members } from './members';

describe('Members', () => {
  let fixture: ComponentFixture<Members>;
  let component: Members;
  let store: {
    members: WritableSignal<ProjectMember[]>;
    roles: WritableSignal<string[]>;
    loading: WritableSignal<boolean>;
    saving: WritableSignal<boolean>;
    removing: WritableSignal<boolean>;
    error: WritableSignal<string | null>;
    load: jasmine.Spy;
    loadRoles: jasmine.Spy;
    assign: jasmine.Spy;
    remove: jasmine.Spy;
  };

  beforeEach(() => {
    store = {
      members: signal<ProjectMember[]>([
        { user: 'bob@example.com', role: 'viewer' },
        { user: 'alice@example.com', role: 'admin' },
      ]),
      roles: signal(['admin', 'viewer']),
      loading: signal(false),
      saving: signal(false),
      removing: signal(false),
      error: signal<string | null>(null),
      load: jasmine.createSpy().and.returnValue(of([])),
      loadRoles: jasmine.createSpy().and.returnValue(of([])),
      assign: jasmine.createSpy().and.callFake((_: string, member: ProjectMember) => of(member)),
      remove: jasmine.createSpy().and.returnValue(of(undefined)),
    };
    TestBed.configureTestingModule({ imports: [Members] });
    TestBed.overrideComponent(Members, {
      set: { providers: [{ provide: MembersStore, useValue: store }] },
    });
    fixture = TestBed.createComponent(Members);
    fixture.componentRef.setInput('projectId', 'demo');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists existing project users in the user dropdown', () => {
    component.openForm();
    fixture.detectChanges();

    const options = Array.from(fixture.nativeElement.querySelectorAll('#member-user option') as NodeListOf<HTMLOptionElement>)
      .map((option) => option.textContent?.trim());
    expect(options).toEqual(['Select a user', 'alice@example.com', 'bob@example.com', '+ Invite new user…']);
    expect(store.loadRoles).toHaveBeenCalledWith('demo');
  });

  it('assigns an existing user to a group', () => {
    component.openForm();
    component.form.setValue({ user: 'bob@example.com', email: '', role: 'admin' });
    component.assign();

    expect(store.assign).toHaveBeenCalledWith('demo', { user: 'bob@example.com', role: 'admin' });
    expect(component.formOpen()).toBeFalse();
  });

  it('switches to an email input when inviting a new user', () => {
    component.openForm();
    component.form.controls.user.setValue(INVITE_NEW_USER);
    fixture.detectChanges();

    expect(component.inviting()).toBeTrue();
    expect(fixture.nativeElement.querySelector('#member-user')).toBeNull();
    expect(fixture.nativeElement.querySelector('#member-email')).not.toBeNull();

    component.form.controls.email.setValue('not-an-email');
    component.form.controls.role.setValue('viewer');
    component.assign();
    expect(store.assign).not.toHaveBeenCalled();

    component.form.controls.email.setValue(' new@example.com ');
    component.assign();
    expect(store.assign).toHaveBeenCalledWith('demo', { user: 'new@example.com', role: 'viewer' });
  });

  it('removes a member binding after confirmation', () => {
    component.confirmRemove({ user: 'bob@example.com', role: 'viewer' });
    component.remove();

    expect(store.remove).toHaveBeenCalledWith('demo', { user: 'bob@example.com', role: 'viewer' });
    expect(component.removeTarget()).toBeNull();
  });
});
