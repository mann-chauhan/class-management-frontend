import { request, type APIRequestContext, type FullConfig } from '@playwright/test';

const frontendOrigin = 'http://localhost:14200';
const expectedApiBaseUrl = 'http://localhost:18080/api/v1';
const backendIdentityUrl = `${expectedApiBaseUrl}/browser-test/identity`;
const environment = (globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined> };
}).process?.env ?? {};

function required(name: string): string {
  const value = environment[name];
  if (!value) {
    throw new Error(`Missing required Advertisement browser-test input: ${name}`);
  }
  return value;
}

function resolveSameOrigin(specifier: string, importer: URL): URL {
  const resolved = new URL(specifier, importer);
  if (resolved.origin !== frontendOrigin) {
    throw new Error(`Advertisement browser test found an unexpected frontend origin: ${resolved.origin}`);
  }
  return resolved;
}

function moduleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const expressions = [
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const expression of expressions) {
    for (let match = expression.exec(source); match; match = expression.exec(source)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function configuredApiValues(source: string, moduleUrl: URL): string[] {
  const values: string[] = [];
  const property = /(?:^|[,{;])\s*["']?apiBaseUrl["']?\s*:\s*(["'])(.*?)\1/g;

  for (let match = property.exec(source); match; match = property.exec(source)) {
    values.push(new URL(match[2], moduleUrl.origin + '/').toString().replace(/\/$/, ''));
  }
  return values;
}

async function verifyServedFrontendApi(frontend: APIRequestContext): Promise<void> {
  const root = new URL('/', frontendOrigin);
  const rootResponse = await frontend.get(root.toString());
  if (!rootResponse.ok()) {
    throw new Error(`Advertisement browser-test frontend is not reachable: HTTP ${rootResponse.status()}`);
  }

  const html = await rootResponse.text();
  const entrypoints = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map(match => match[1])
    .filter(Boolean);
  if (entrypoints.length === 0) {
    throw new Error('Advertisement browser-test frontend has no JavaScript entrypoint');
  }

  const queue = entrypoints.map(specifier => resolveSameOrigin(specifier, root));
  const visited = new Set<string>();
  const values: string[] = [];

  while (queue.length > 0) {
    const moduleUrl = queue.shift()!;
    const key = moduleUrl.toString();
    if (visited.has(key)) continue;
    visited.add(key);

    const response = await frontend.get(key);
    if (!response.ok()) {
      throw new Error(`Unable to inspect Advertisement frontend module: HTTP ${response.status()}`);
    }
    const source = await response.text();
    values.push(...configuredApiValues(source, moduleUrl));
    for (const specifier of moduleSpecifiers(source)) {
      queue.push(resolveSameOrigin(specifier, moduleUrl));
    }
  }

  const resolved = [...new Set(values)];
  if (resolved.length !== 1 || resolved[0] !== expectedApiBaseUrl) {
    throw new Error('Served Advertisement frontend API configuration is not the isolated browser-test backend');
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  if (environment.ADVERTISEMENT_E2E_TEST_MODE !== 'integration') {
    throw new Error('ADVERTISEMENT_E2E_TEST_MODE must be exactly integration; no mock authentication is supported.');
  }

  for (const name of [
    'ADVERTISEMENT_E2E_ADMIN_EMAIL',
    'ADVERTISEMENT_E2E_TEACHER_EMAIL',
    'ADVERTISEMENT_E2E_STUDENT_EMAIL',
    'ADVERTISEMENT_E2E_TEST_PASSWORD',
    'ADVERTISEMENT_E2E_FIXTURE_MARKER',
  ]) {
    required(name);
  }

  for (const name of ['DB_URL', 'DATABASE_URL', 'SPRING_DATASOURCE_URL']) {
    if (environment[name]) {
      throw new Error(`Refusing Advertisement browser tests while ${name} is set.`);
    }
  }

  for (const project of config.projects) {
    if (project.use.baseURL !== frontendOrigin) {
      throw new Error(`Advertisement Playwright baseURL must be exactly ${frontendOrigin}`);
    }
  }

  const identity = await request.newContext({
    baseURL: backendIdentityUrl,
    extraHTTPHeaders: { Accept: 'application/json' },
  });
  try {
    const response = await identity.get('');
    if (!response.ok()) {
      throw new Error(`Advertisement browser-test backend identity check failed: HTTP ${response.status()}`);
    }
    const body = await response.json() as { database?: string; port?: number; address?: string };
    if (body.database !== 'cms_leave_test'
      || body.port !== 5432
      || !['127.0.0.1', '::1'].includes(body.address ?? '')) {
      throw new Error('Advertisement browser-test backend identity did not match cms_leave_test on loopback:5432');
    }
  } finally {
    await identity.dispose();
  }

  const frontend = await request.newContext({ baseURL: frontendOrigin });
  try {
    await verifyServedFrontendApi(frontend);
  } finally {
    await frontend.dispose();
  }
}
