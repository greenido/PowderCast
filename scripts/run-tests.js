#!/usr/bin/env node
/**
 * Run the test suites.
 *
 * Two problems this solves.
 *
 * The suites used to be chained in package.json with `&&`, so the first failure
 * hid every suite after it. You fixed one thing, pushed, and discovered the
 * next one — a round trip through CI per broken suite. Every suite runs here,
 * and the summary at the end lists all of them.
 *
 * And each suite had to be registered by hand, which is easy to forget:
 * tests/new-features.test.ts and tests/weather-api.test.ts were never added and
 * had gone unrun for their whole existence. Suites are discovered from the
 * directory instead, so a new file is picked up by writing it.
 *
 * Suites that reach the network mark themselves with `@network` near the top.
 * They are excluded by default and run with `--network`, because CI must not
 * fail because NOAA is having a morning.
 *
 *   node scripts/run-tests.js            # offline suites (the default)
 *   node scripts/run-tests.js --network  # live API contract tests
 *   node scripts/run-tests.js scoring    # one suite, by substring
 */

const { readdirSync, readFileSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const NETWORK_MARKER = '@network';

/** Only the header is scanned, so the marker cannot be matched by prose. */
const HEADER_BYTES = 1500;

function discover() {
  return readdirSync(TESTS_DIR)
    .filter((name) => name.endsWith('.test.ts'))
    .sort()
    .map((name) => {
      const file = path.join(TESTS_DIR, name);
      const header = readFileSync(file, 'utf8').slice(0, HEADER_BYTES);
      return {
        name: name.replace(/\.test\.ts$/, ''),
        file,
        network: header.includes(NETWORK_MARKER),
      };
    });
}

function run(suite) {
  const result = spawnSync(
    process.execPath,
    [require.resolve('ts-node/dist/bin.js'), suite.file],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, TS_NODE_PROJECT: 'tsconfig.test.json' },
    }
  );

  // A suite killed by a signal (out of memory, CI timeout) has no exit code.
  if (result.status === null) {
    return { ok: false, detail: result.signal ? `killed by ${result.signal}` : 'did not run' };
  }
  return { ok: result.status === 0, detail: `exit ${result.status}` };
}

function main() {
  const args = process.argv.slice(2);
  const wantNetwork = args.includes('--network');
  const filters = args.filter((arg) => !arg.startsWith('--'));

  let suites = discover().filter((suite) => suite.network === wantNetwork);
  if (filters.length) {
    suites = suites.filter((suite) => filters.some((f) => suite.name.includes(f)));
  }

  if (suites.length === 0) {
    console.error(
      filters.length
        ? `No ${wantNetwork ? 'network' : 'offline'} suite matches: ${filters.join(', ')}`
        : 'No test suites found.'
    );
    process.exit(1);
  }

  console.log(
    `Running ${suites.length} ${wantNetwork ? 'network' : 'offline'} suite(s): ` +
      suites.map((s) => s.name).join(', ')
  );

  const failed = [];
  for (const suite of suites) {
    const { ok, detail } = run(suite);
    if (!ok) failed.push({ name: suite.name, detail });
  }

  console.log('\n' + '─'.repeat(60));
  for (const suite of suites) {
    const failure = failed.find((f) => f.name === suite.name);
    console.log(`  ${failure ? '✗' : '✓'} ${suite.name}${failure ? `  (${failure.detail})` : ''}`);
  }
  console.log('─'.repeat(60));

  if (failed.length) {
    console.error(`\n${failed.length} of ${suites.length} suite(s) failed.\n`);
    process.exit(1);
  }
  console.log(`\nAll ${suites.length} suite(s) passed.\n`);
}

main();
