import { Injectable, signal } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class SidebarStore {
    private readonly _isExpanded = signal<boolean>(true);
    private readonly _isMobileOpen = signal<boolean>(false);
    private readonly _isHovered = signal<boolean>(false);

    readonly isExpanded = this._isExpanded.asReadonly();
    readonly isMobileOpen = this._isMobileOpen.asReadonly();
    readonly isHovered = this._isHovered.asReadonly();

    setExpanded(val: boolean) {
        this._isExpanded.set(val);
    }

    toggleExpanded() {
        this._isExpanded.update(v => !v);
    }

    setMobileOpen(val: boolean) {
        this._isMobileOpen.set(val);
    }

    toggleMobileOpen() {
        this._isMobileOpen.update(v => !v);
    }

    setHovered(val: boolean) {
        this._isHovered.set(val);
    }
}