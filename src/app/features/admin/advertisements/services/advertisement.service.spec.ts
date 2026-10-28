import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { API_ENDPOINTS } from '../../../../core/constants/api-endpoints';
import { ApiService } from '../../../../core/services/api.service';
import { AdvertisementFeed, ApiResponse } from '../models/advertisement.model';
import { AdvertisementService } from './advertisement.service';

describe('AdvertisementService feed API', () => {
  let service: AdvertisementService;
  let api: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn().mockReturnValue(of({ success: true, message: 'ok', data: [] })) };
    TestBed.configureTestingModule({
      providers: [AdvertisementService, { provide: ApiService, useValue: api }]
    });
    service = TestBed.inject(AdvertisementService);
  });

  it('requests the authenticated audience feed endpoint', () => {
    service.getFeed().subscribe();

    expect(api.get).toHaveBeenCalledWith(API_ENDPOINTS.ADVERTISEMENTS.FEED);
  });

  it('preserves the advertisement feed envelope and display settings', () => {
    const response = {
      success: true,
      message: 'ok',
      data: {
        advertisements: [],
        displaySettings: {
          defaultRotationIntervalMs: 7000,
          transitionDurationMs: 750
        }
      }
    };
    api.get.mockReturnValue(of(response));

    let received: ApiResponse<AdvertisementFeed> | undefined;
    service.getFeed().subscribe(value => { received = value; });

    expect(received).toEqual(response);
  });

  it('serializes the all-status listing filter', () => {
    service.list(2, 10, 'ALL').subscribe();

    const params = api.get.mock.calls[0][1];
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('10');
    expect(params.get('status')).toBe('ALL');
  });

  it('preserves draft-only behavior for callers that omit the listing status', () => {
    service.list().subscribe();

    expect(api.get.mock.calls[0][1].get('status')).toBe('DRAFT');
  });
});
