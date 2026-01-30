import { effect, Injectable, signal } from "@angular/core";

type Theme = 'light' | 'dark';

@Injectable({
    providedIn: 'root'
})
export class ThemeStore {
    private readonly _themeSubject = signal<Theme>('light');

    readonly theme = this._themeSubject.asReadonly();

    constructor() {
        effect(() => {
            localStorage.setItem('theme', this._themeSubject());
            if (this._themeSubject() === 'dark') {
                document.documentElement.classList.add('dark');
                document.body.classList.add('dark:bg-gray-900');
            } else {
                document.documentElement.classList.remove('dark');
                document.body.classList.remove('dark:bg-gray-900');
            }
        })

        const savedTheme = (localStorage.getItem('theme') as Theme) || 'light';
        this._themeSubject.set(savedTheme);
    }

    toggleTheme() {
        this._themeSubject.update(current => current === 'light' ? 'dark' : 'light');
    }
}