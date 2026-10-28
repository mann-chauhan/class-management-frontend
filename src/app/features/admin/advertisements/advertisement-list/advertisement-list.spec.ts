import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { Router } from '@angular/router';
import { AdvertisementListComponent } from './advertisement-list';
import { AdvertisementService } from '../services/advertisement.service';

describe('AdvertisementListComponent', () => {
  let fixture: ComponentFixture<AdvertisementListComponent>;
  let service: {
    list: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      list: vi.fn().mockReturnValue(of({
        success: true,
        message: 'ok',
        data: {
          content: [
            {
              id: 1,
              title: 'Draft',
              description: null,
              audience: 'STUDENT',
              layout: 'STATIC_BANNER',
              ctaLabel: null,
              ctaDestination: null,
              publishAt: null,
              expiresAt: null,
              status: 'DRAFT',
              version: 0,
              media: [],
              mediaCount: 0
            },
            {
              id: 2,
              title: 'Published',
              description: null,
              audience: 'TEACHER',
              layout: 'STATIC_BANNER',
              ctaLabel: null,
              ctaDestination: null,
              publishAt: null,
              expiresAt: null,
              status: 'PUBLISHED',
              version: 1,
              media: [],
              mediaCount: 1
            },
            {
              id: 3,
              title: 'Archived',
              description: null,
              audience: 'BOTH',
              layout: 'STATIC_BANNER',
              ctaLabel: null,
              ctaDestination: null,
              publishAt: null,
              expiresAt: null,
              status: 'ARCHIVED',
              version: 2,
              media: [],
              mediaCount: 2
            }
          ],
          page: 0,
          size: 20,
          totalElements: 3,
          totalPages: 1
        }
      })),
      publish: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      archive: vi.fn(),
      delete: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AdvertisementListComponent],
      providers: [
        { provide: AdvertisementService, useValue: service },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdvertisementListComponent);
    fixture.detectChanges();
  });

  it('requests all statuses and displays server media counts', () => {
    expect(service.list).toHaveBeenCalledWith(0, 20, 'ALL');

    const mediaCells = Array.from(
      fixture.nativeElement.querySelectorAll('tbody tr td:nth-child(4)')
    ).map(cell => (cell as Element).textContent?.trim());

    expect(mediaCells).toEqual(['0', '1', '2']);
  });

  it('keeps lifecycle actions aligned with each returned status', () => {
    const rows = Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as HTMLElement[];
    const labels = rows.map(row => Array.from(row.querySelectorAll('button'))
      .map(button => button.textContent?.trim())
      .filter(Boolean));

    expect(labels[0]).toEqual(['Edit', 'Delete']);
    expect(labels[1]).toEqual(['Open', 'Delete']);
    expect(labels[2]).toEqual(['Open', 'Delete']);
  });

  it('uses irreversible confirmation wording only for delete', () => {
    expect(fixture.componentInstance.actionMessage('pause', 'Published ad'))
      .not.toContain('cannot be undone');
    expect(fixture.componentInstance.actionMessage('delete', 'Published ad'))
      .toContain('cannot be undone');
  });

  it('shows one visible success notification after a confirmed lifecycle action', () => {
    service.publish.mockReturnValue(of({ success: true, message: 'ok', data: null }));
    const component = fixture.componentInstance;
    component.confirmAction(component.advertisements[0], 'publish');
    component.executeAction();
    fixture.detectChanges();

    expect(component.successMessage).toBe('Advertisement published successfully.');
    expect(fixture.nativeElement.querySelectorAll('.advertisement-success-notification')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('published successfully');
  });

  it('shows an actionable error and no success notification when lifecycle action fails', () => {
    service.pause.mockReturnValue(throwError(() => ({ error: { message: 'Version conflict. Refresh and try again.' } })));
    const component = fixture.componentInstance;
    component.confirmAction(component.advertisements[1], 'pause');
    component.executeAction();
    fixture.detectChanges();

    expect(component.errorMessage).toContain('Version conflict');
    expect(component.successMessage).toBe('');
    expect(fixture.nativeElement.querySelector('.advertisement-success-notification')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Version conflict');
  });

  it('does not duplicate lifecycle requests or notifications while an action is busy', () => {
    const response$ = new Subject<{ success: boolean; message: string; data: null }>();
    service.resume.mockReturnValue(response$);
    const component = fixture.componentInstance;
    component.confirmAction(component.advertisements[1], 'resume');
    component.executeAction();
    component.confirmAction(component.advertisements[1], 'resume');
    component.executeAction();
    response$.next({ success: true, message: 'ok', data: null });
    response$.complete();
    fixture.detectChanges();

    expect(service.resume).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelectorAll('.advertisement-success-notification')).toHaveLength(1);
  });
});
