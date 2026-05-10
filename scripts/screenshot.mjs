// Screenshot script — capture toutes les pages clés en mobile + desktop
import pkg from '/tmp/node_modules/playwright-core/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = '/home/user/ikcp-site/proposals/screenshots';
mkdirSync(OUT_DIR, { recursive: true });

const PAGES = [
  // Public + entrées
  { id: '01-site-ikcp-eu',         url: 'http://localhost:8088/index.html' },
  { id: '02-univers-v5-freemium',  url: 'http://localhost:8088/proposals/family-office-v5-univers.html' },
  { id: '03-conviction-overview',  url: 'http://localhost:8088/proposals/conviction-overview.html' },
  { id: '04-espaces-fo-tarifs',    url: 'http://localhost:8088/proposals/espaces-fo.html' },
  { id: '05-sur-mesure-tarif',     url: 'http://localhost:8088/proposals/sur-mesure-tarif.html' },
  // Beta
  { id: '06-landing-beta',         url: 'http://localhost:8088/proposals/landing-beta-dirigeants.html' },
  { id: '07-formation-nextgen',    url: 'http://localhost:8088/proposals/formation-nextgen.html' },
  { id: '08-famille-apprenante',   url: 'http://localhost:8088/proposals/famille-apprenante.html' },
  { id: '09-international',        url: 'http://localhost:8088/proposals/expertise-internationale.html' },
  // Membres
  { id: '10-dashboard-membre',     url: 'http://localhost:8088/proposals/dashboard-famille-office.html' },
  // Transparence + admin
  { id: '11-roadmap-publique',     url: 'http://localhost:8088/proposals/roadmap-publique.html' },
  { id: '12-admin-dashboard',      url: 'http://localhost:8088/proposals/admin-dashboard.html' },
  // Légal
  { id: '13-mentions-legales',     url: 'http://localhost:8088/proposals/legal/mentions-legales.html' },
  { id: '14-cgu',                  url: 'http://localhost:8088/proposals/legal/cgu.html' },
  { id: '15-politique-cookies',    url: 'http://localhost:8088/proposals/legal/politique-cookies.html' },
  // Aperçu
  { id: '00-apercu-ecosysteme',    url: 'http://localhost:8088/proposals/apercu-ecosysteme.html' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile',  width: 390,  height: 844 },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.name === 'mobile',
  });
  const page = await context.newPage();

  for (const p of PAGES) {
    try {
      await page.goto(p.url, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(800); // laisse les fonts + animations
      const out = join(OUT_DIR, `${p.id}-${viewport.name}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`✓ ${p.id} ${viewport.name}`);
    } catch (e) {
      console.error(`✗ ${p.id} ${viewport.name} : ${e.message}`);
    }
  }
  await context.close();
}

await browser.close();
console.log('Done.');
