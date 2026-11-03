import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DEFAULT_CATALOG_FALLBACK_URLS, DEFAULT_CATALOG_URL, DEFAULT_STARTUP_TIMEOUT_MS } from '../lib/constants.js';
import { Config } from '../lib/index.js';

test('default config uses the independent public registry', () => {
  assert.equal(
    DEFAULT_CATALOG_URL,
    'https://cdn.jsdelivr.net/gh/duhu2000/dsh-mcp-connector-registry@main/catalog.json',
  );
  assert.deepEqual(DEFAULT_CATALOG_FALLBACK_URLS, [
    'https://fastly.jsdelivr.net/gh/duhu2000/dsh-mcp-connector-registry@main/catalog.json',
    'https://gcore.jsdelivr.net/gh/duhu2000/dsh-mcp-connector-registry@main/catalog.json',
    'https://raw.githubusercontent.com/duhu2000/dsh-mcp-connector-registry/main/catalog.json',
  ]);
  assert.equal(Config({}).catalogUrl, DEFAULT_CATALOG_URL);
  assert.equal(Config({}).startupTimeoutMs, DEFAULT_STARTUP_TIMEOUT_MS);
  assert.equal(Config({}).showSidebarEntry, true);
});

test('fallback sources are distinct jsDelivr edge mirrors before GitHub raw', () => {
  const registryPath = '/gh/duhu2000/dsh-mcp-connector-registry@main/catalog.json';
  assert.equal(new Set(DEFAULT_CATALOG_FALLBACK_URLS).size, DEFAULT_CATALOG_FALLBACK_URLS.length);
  assert.ok(DEFAULT_CATALOG_FALLBACK_URLS.length >= 2);
  for (const url of DEFAULT_CATALOG_FALLBACK_URLS) {
    assert.match(url, /^https:\/\//);
  }
  // 至少一个备用源与主源不同的 jsDelivr 边缘域名，避免主域被重置时无镜像可用。
  const edgeHosts = DEFAULT_CATALOG_FALLBACK_URLS.filter((url) => url.includes('.jsdelivr.net'));
  assert.ok(edgeHosts.length >= 1, 'expected a jsDelivr edge mirror fallback');
  assert.equal(new URL(DEFAULT_CATALOG_URL).hostname, 'cdn.jsdelivr.net');
  for (const url of edgeHosts) {
    assert.notEqual(new URL(url).hostname, new URL(DEFAULT_CATALOG_URL).hostname);
    assert.ok(url.endsWith(registryPath));
  }
  assert.ok(DEFAULT_CATALOG_FALLBACK_URLS.at(-1).includes('raw.githubusercontent.com'));
});

test('an explicit empty catalogUrl keeps bundled-only mode available', () => {
  assert.equal(Config({ catalogUrl: '' }).catalogUrl, '');
});

test('an explicit custom catalogUrl remains unchanged', () => {
  const customUrl = 'https://registry.example.com/catalog.json';
  assert.equal(Config({ catalogUrl: customUrl }).catalogUrl, customUrl);
});

test('bundle patch uses the same jsDelivr primary catalog source', () => {
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.match(patch, new RegExp(DEFAULT_CATALOG_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(patch, /catalogUrl:\s*['"]https:\/\/raw\.githubusercontent\.com/);
  assert.match(patch, /showSidebarEntry:\s*true/);
});

test('client bundle is self-contained across Host store/runtime module layouts', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const clientSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

  assert.doesNotMatch(clientSource, /require\("@deepseek-ai\/dsh-client-(?:store|runtime|ui-primitives)/);
  assert.equal(packageJson.dsh.client.external, undefined);
  assert.ok(!packageJson.dsh.client.inject.includes('@deepseek-ai/dsh-client-runtime'));
  assert.equal(packageJson.peerDependencies['@deepseek-ai/dsh-client-store'], undefined);
  assert.equal(packageJson.peerDependencies['@deepseek-ai/dsh-client-ui-primitives'], undefined);
  assert.equal(packageJson.peerDependencies['@deepseek-ai/dsh-client-runtime'], undefined);
  assert.equal(packageJson.peerDependencies.zod, undefined);
  assert.equal(packageJson.dependencies.zod, '^4.1.8');
  assert.equal(packageJson.devDependencies.zod, undefined);
  assert.equal(
    packageJson.peerDependencies['@deepseek-ai/dsh-mcp-client'],
    '^0.1.1-rc.2 || >=0.2.0-rc.1 <0.3.0-0',
  );
});
