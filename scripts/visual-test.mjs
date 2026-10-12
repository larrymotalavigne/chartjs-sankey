/*
 * Visual regression tests (run after `npm run build`).
 *
 * Renders every fixture of test/visual/fixtures.js with the UMD build in
 * headless Chromium and compares it with its reference PNG in
 * test/visual/__snapshots__. Differences are written to test/visual/__diff__.
 *
 *   npm run test:visual            # compare
 *   npm run test:visual -- --update  # (re)write the reference images
 */
/* global document, Chart -- used inside page.evaluate(), which runs in the browser */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { fixtures } from '../test/visual/fixtures.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshotDir = join(root, 'test/visual/__snapshots__');
const diffDir = join(root, 'test/visual/__diff__');
const update = process.argv.includes('--update');
/** Default share of pixels allowed to differ (antialiasing noise). */
const DEFAULT_TOLERANCE = 0.002;
/**
 * Per-pixel color distance (pixelmatch, 0..1) above which a pixel counts as
 * different. Kept low so subtle color changes (e.g. flow opacity) are caught.
 */
const PIXEL_THRESHOLD = 0.02;

const scripts = [
  readFileSync(join(root, 'node_modules/chart.js/dist/chart.umd.js'), 'utf8'),
  readFileSync(join(root, 'dist/chartjs-plugin-sankey.js'), 'utf8')
];

async function render(browser, fixture) {
  const dpr = fixture.dpr || 1;
  const context = await browser.newContext({
    viewport: { width: fixture.width, height: fixture.height },
    deviceScaleFactor: dpr
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setContent('<!doctype html><html><body style="margin:0;background:#fff"></body></html>');
  for (const content of scripts) await page.addScriptTag({ content });
  await page.evaluate(({ width, height, dataset }) => {
    const canvas = document.createElement('canvas');
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    document.body.appendChild(canvas);
    new Chart(canvas, {
      type: 'sankey',
      data: { datasets: [dataset] },
      options: { responsive: false, animation: false, events: [] }
    });
  }, fixture);
  const buffer = await page.locator('canvas').screenshot({ animations: 'disabled' });
  await context.close();
  if (errors.length) throw new Error(`${fixture.name}: page errors: ${errors.join('; ')}`);
  return buffer;
}

async function main() {
  mkdirSync(snapshotDir, { recursive: true });
  rmSync(diffDir, { recursive: true, force: true });
  const browser = await chromium.launch();
  let failures = 0;
  try {
    for (const fixture of fixtures) {
      const actual = await render(browser, fixture);
      const snapshot = join(snapshotDir, `${fixture.name}.png`);
      if (update || !existsSync(snapshot)) {
        writeFileSync(snapshot, actual);
        console.log(`written - ${fixture.name}`);
        continue;
      }
      const expected = PNG.sync.read(readFileSync(snapshot));
      const got = PNG.sync.read(actual);
      if (expected.width !== got.width || expected.height !== got.height) {
        failures++;
        mkdirSync(diffDir, { recursive: true });
        writeFileSync(join(diffDir, `${fixture.name}.actual.png`), actual);
        console.error(`FAIL - ${fixture.name}: size ${got.width}x${got.height}, expected ${expected.width}x${expected.height}`);
        continue;
      }
      const diff = new PNG({ width: got.width, height: got.height });
      const changed = pixelmatch(expected.data, got.data, diff.data, got.width, got.height, { threshold: PIXEL_THRESHOLD });
      const ratio = changed / (got.width * got.height);
      const tolerance = fixture.tolerance ?? DEFAULT_TOLERANCE;
      if (ratio > tolerance) {
        failures++;
        mkdirSync(diffDir, { recursive: true });
        writeFileSync(join(diffDir, `${fixture.name}.actual.png`), actual);
        writeFileSync(join(diffDir, `${fixture.name}.diff.png`), PNG.sync.write(diff));
        console.error(`FAIL - ${fixture.name}: ${(ratio * 100).toFixed(2)}% of pixels differ (max ${(tolerance * 100).toFixed(2)}%)`);
      } else {
        console.log(`ok - ${fixture.name} (${(ratio * 100).toFixed(3)}% differ)`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failures) {
    console.error(`${failures} visual difference(s); see test/visual/__diff__. Run with --update if the change is intended.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
