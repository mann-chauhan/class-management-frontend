import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiService } from '../../../../../core/services/api.service';
import { SchoolService } from './school.service';

describe('SchoolService active lookup', () => {
  it('requests the dedicated active-school endpoint with paging and search', () => {
    const api = {
      get: vi.fn(() => of({}))
    };

    TestBed.configureTestingModule({
      providers: [
        SchoolService,
        { provide: ApiService, useValue: api }
      ]
    });

    TestBed.inject(SchoolService)
      .getActiveSchools(2, 20, 'Central School')
      .subscribe();

    expect(api.get).toHaveBeenCalledWith(
      '/schools/active?page=2&size=20&search=Central+School'
    );
  });
});
