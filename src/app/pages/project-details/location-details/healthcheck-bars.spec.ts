import { OverlayContainer } from '@angular/cdk/overlay';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HealthcheckBars } from './healthcheck-bars';

describe('HealthcheckBars', () => {
  it('shows healthcheck details on hover and hides them on mouse leave', fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [HealthcheckBars],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }],
    });
    const fixture = TestBed.createComponent(HealthcheckBars);
    fixture.componentRef.setInput('label', 'http on n2 across all sources');
    fixture.componentRef.setInput('results', [{
      time: '2026-10-06T10:00:01Z', start: '2026-10-06T10:00:00Z',
      source: 'fra', code: -1, alive: false, durationMs: 3.6, message: 'connection refused',
    }]);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const bar = element.querySelector<HTMLElement>('li.bg-error-500')!;
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(bar.getAttribute('title')).toBeNull();
    expect(bar.tabIndex).toBe(0);
    bar.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    tick(200);
    fixture.detectChanges();
    const tooltip = overlay.querySelector('.mat-mdc-tooltip-surface');
    expect(tooltip).not.toBeNull();
    for (const detail of [
      'http on n2 across all sources', 'Status: Unhealthy', 'Source: fra',
      'Time:', 'Started:', 'Code: -1', 'Duration: 3.6 ms', 'Message: connection refused',
    ]) {
      expect(tooltip?.textContent).toContain(detail);
    }
    expect(overlay.querySelector('.healthcheck-bar-tooltip')).not.toBeNull();
    bar.dispatchEvent(new MouseEvent('mouseleave'));
    tick(500);
    fixture.detectChanges();
    expect(overlay.querySelector('.mat-mdc-tooltip-surface')).toBeNull();
    fixture.destroy();
  }));

  it('handles unknown sources and preserves zero code and duration values', () => {
    TestBed.configureTestingModule({ imports: [HealthcheckBars] });
    const fixture = TestBed.createComponent(HealthcheckBars);
    fixture.componentRef.setInput('label', 'http on n1');
    fixture.componentRef.setInput('results', []);
    fixture.detectChanges();
    const label = fixture.componentInstance.barLabel({
      time: '2026-10-06T10:00:00Z', source: '', alive: true, code: 0, durationMs: 0, message: '',
    });
    expect(label).toContain('Status: Healthy');
    expect(label).toContain('Source: Unknown source');
    expect(label).toContain('Code: 0');
    expect(label).toContain('Duration: 0.0 ms');
    expect(label).not.toContain('Started:');
    expect(label).not.toContain('Message:');
    fixture.destroy();
  });
});
