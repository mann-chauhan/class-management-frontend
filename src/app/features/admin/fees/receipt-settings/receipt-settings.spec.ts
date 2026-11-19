import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service';
import { ReceiptSettingsService } from '../services/receipt-settings.service';
import { ReceiptSettingsComponent } from './receipt-settings';
describe('ReceiptSettingsComponent', () => {
  let component: ReceiptSettingsComponent; let service: any; let feedback: any;
  beforeEach(() => { service = { getSettings: vi.fn(), updateSettings: vi.fn(), uploadLogo: vi.fn(), uploadSignature: vi.fn(), uploadStamp: vi.fn(), uploadBadge: vi.fn() }; feedback = { show: vi.fn() }; TestBed.configureTestingModule({ imports: [ReceiptSettingsComponent], providers: [{ provide: ReceiptSettingsService, useValue: service }, { provide: Router, useValue: { navigate: vi.fn() } }, { provide: ActionFeedbackService, useValue: feedback }] }); component = TestBed.createComponent(ReceiptSettingsComponent).componentInstance; component.settings = { institutionName: 'CMS' } as any; });
  it('shows success for settings save', () => { service.updateSettings.mockReturnValue(of(component.settings)); component.saveSettings(); expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: 'Receipt settings saved successfully.' }); });
  it('keeps settings after save failure', () => { service.updateSettings.mockReturnValue(throwError(() => ({ error: { message: 'Failed' } }))); component.saveSettings(); expect(component.errorMessage).toBe('Failed'); expect(component.settings?.institutionName).toBe('CMS'); });
  it.each([
    ['logo', 'uploadLogo', 'Logo'],
    ['signature', 'uploadSignature', 'Signature'],
    ['stamp', 'uploadStamp', 'Stamp / Seal'],
    ['badge', 'uploadBadge', 'Badge']
  ])('uploads %s through its independent service operation', (_type, method, label) => {
    service[method].mockReturnValue(of(component.settings));
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [new File(['x'], `${_type}.png`, { type: 'image/png' })] });
    (component as any)[method]({ target: input } as any);
    expect(service[method]).toHaveBeenCalledTimes(1);
    expect(feedback.show).toHaveBeenCalledWith({ kind: 'success', message: `${label} updated successfully.` });
  });
});
