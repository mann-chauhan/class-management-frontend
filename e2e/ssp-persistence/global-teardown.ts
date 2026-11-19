import { request } from '@playwright/test';
import { loginAndRegisterSession } from './ssp-persistence-fixtures';

const backendOrigin = 'http://localhost:18080';

export default async function globalTeardown(): Promise<void> {
  const controlSecret = process.env.SSP_BROWSER_CONTROL_SECRET;
  if (!controlSecret || !controlSecret.trim()) {
    throw new Error('Missing SSP persistence input: SSP_BROWSER_CONTROL_SECRET; manifest was retained');
  }
  const api = await request.newContext({ baseURL: backendOrigin });
  try {
    const accessToken = await loginAndRegisterSession(api);
    const response = await api.post(`${backendOrigin}/api/v1/ssp-browser-fixtures/cleanup`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-SSP-Browser-Control-Secret': controlSecret,
      },
      data: { runId: process.env.SSP_BROWSER_RUN_ID },
    });
    if (!response.ok()) {
      throw new Error(`SSP persistence cleanup failed: HTTP ${response.status()}; manifest was retained`);
    }
  } finally {
    await api.dispose();
  }
}
