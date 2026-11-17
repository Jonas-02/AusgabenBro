import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [ziel, ...bilder] = process.argv.slice(2);
const html = '<body style="margin:0;background:#000;display:flex;gap:8px;align-items:flex-start">' + bilder.map(b => `<img src="data:image/png;base64,${fs.readFileSync(b).toString('base64')}" style="width:393px">`).join('') + '</body>';
const br = await chromium.launch(); const p = await br.newPage({ viewport: { width: bilder.length * 401, height: 900 } });
await p.setContent(html); await p.waitForTimeout(200); await p.screenshot({ path: ziel, fullPage: true }); await br.close();
