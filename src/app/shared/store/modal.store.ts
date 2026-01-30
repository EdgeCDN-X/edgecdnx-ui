import { Injectable, signal } from "@angular/core";


@Injectable({
    providedIn: 'root'
})
export class ModalStore {

    private readonly _isOpen = signal<boolean>(false);

    readonly isOpen = this._isOpen.asReadonly();

    openModal() {
        this._isOpen.set(true);
    }

    closeModal() {
        this._isOpen.set(false);
    }

    toggleModal() {
        this._isOpen.update(isOpen => !isOpen);
    }
}