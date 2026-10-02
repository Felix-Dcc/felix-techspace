'use strict';
/*
 * Browser regression tests for the portfolio.
 *
 * Builds _deploy/ with stage.sh, then serves it to Chromium through
 * Playwright's request interception with the headers from _deploy/_headers
 * applied, so the production CSP is in force. The GitHub API, Google Fonts and
 * the form endpoint are stubbed: nothing leaves the machine.
 *
 *   cd tests
 *   npm install
 *   npx playwright install chromium
 *   npm test
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DEPLOY = path.join(ROOT, '_deploy');
const ORIGIN = 'https://felix-techspace.test';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

function repo(name, o = {}) {
  return {
    name,
    description: o.description === undefined ? name + ' description' : o.description,
    language: o.language === undefined ? 'Python' : o.language,
    html_url: o.html_url || 'https://github.com/Felix-Dcc/' + name,
    homepage: o.homepage || null,
    pushed_at: o.pushed === undefined ? '2026-01-01T00:00:00Z' : o.pushed,
    stargazers_count: o.stars || 0,
    fork: !!o.fork,
    archived: !!o.archived,
  };
}

// After filtering and sorting, the grid should show exactly REPO_ORDER.
const REPOS = [
  repo('beta', { pushed: '2026-09-01T00:00:00Z', language: 'Go' }),
  repo('alpha', { stars: 5, pushed: '2026-07-01T00:00:00Z', homepage: 'https://alpha.example/' }),
  repo('gamma', { stars: 5, pushed: '2026-08-01T00:00:00Z', language: 'C++' }),
  repo('forked', { stars: 50, fork: true }),
  repo('old', { stars: 50, archived: true }),
  repo('laundromart-', { stars: 50 }),
  repo('e1', { pushed: '2026-06-01T00:00:00Z', language: null }),
  repo('e2', { pushed: '2026-05-01T00:00:00Z' }),
  repo('e3', { pushed: '2026-04-01T00:00:00Z' }),
  repo('e4', { pushed: '2026-03-01T00:00:00Z' }),
];
const REPO_ORDER = ['gamma', 'alpha', 'beta', 'e1', 'e2', 'e3'];

/* -- _headers -------------------------------------------------------------- */

function parseHeaders(file) {
  const rules = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { rules.push({ path: line.trim(), headers: [] }); continue; }
    const i = line.indexOf(':');
    rules[rules.length - 1].headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return rules;
}

// Netlify-style path matching: * matches any run of characters.
function ruleMatches(rulePath, urlPath) {
  const re = rulePath.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + re + '$').test(urlPath);
}

let rules = [];

function headersFor(urlPath) {
  return rules.filter((r) => ruleMatches(r.path, urlPath)).flatMap((r) => r.headers);
}

function headerValue(urlPath, name) {
  return headersFor(urlPath)
    .filter(([n]) => n.toLowerCase() === name.toLowerCase())
    .map(([, v]) => v).join(', ');
}

/* -- server ---------------------------------------------------------------- */

async function serve(route, opts, log) {
  const req = route.request();
  const url = new URL(req.url());

  if (url.origin === ORIGIN) {
    if (req.method() === 'POST') {
      log.posts.push({ path: url.pathname, type: req.headers()['content-type'] || '', body: req.postData() || '' });
      return route.fulfill({ status: opts.formStatus || 200, contentType: 'text/html', body: '<p>Thanks</p>' });
    }
    if ((opts.block || []).includes(url.pathname)) return route.abort();
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.join(DEPLOY, rel);
    if (!file.startsWith(DEPLOY) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });
    }
    const headers = { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' };
    for (const [n, v] of headersFor(url.pathname)) {
      const k = n.toLowerCase();
      headers[k] = headers[k] && k !== 'content-type' ? headers[k] + ', ' + v : v;
    }
    return route.fulfill({ status: 200, headers, body: fs.readFileSync(file) });
  }

  if (url.hostname === 'api.github.com') {
    if (opts.githubStatus) return route.fulfill({ status: opts.githubStatus, headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(opts.repos || REPOS),
    });
  }

  if (url.hostname === 'fonts.googleapis.com') {
    if (opts.fontDelay) await new Promise((r) => setTimeout(r, opts.fontDelay));
    return route.fulfill({ status: 200, contentType: 'text/css', body: '/* font stub */' });
  }

  return route.abort();
}

let browser;

before(async () => {
  const r = spawnSync('bash', ['stage.sh'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, 'stage.sh failed:\n' + r.stdout + r.stderr);
  rules = parseHeaders(path.join(DEPLOY, '_headers'));
  browser = await chromium.launch();
});

after(async () => { if (browser) await browser.close(); });

async function open(opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 800 },
    colorScheme: opts.colorScheme || 'light',
    javaScriptEnabled: opts.javaScriptEnabled !== false,
  });
  const page = await context.newPage();
  const log = { errors: [], posts: [] };
  page.on('pageerror', (e) => log.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI);
    });
  });
  if (opts.init) await context.addInitScript(opts.init);
  await context.route('**/*', (route) => serve(route, opts, log));
  await page.goto(ORIGIN + '/', { waitUntil: opts.waitUntil || 'load' });
  return { page, context, log };
}

async function close(t) { await t.context.close(); }

/* -- page helpers ---------------------------------------------------------- */

function hiddenReveals(page) {
  return page.$$eval('.reveal', (els) =>
    els.filter((e) => getComputedStyle(e).opacity !== '1').map((e) => e.id || e.className));
}

async function waitAllRevealed(page, ms) {
  await page.waitForFunction(
    () => [...document.querySelectorAll('.reveal')].every((e) => getComputedStyle(e).opacity === '1'),
    null, { timeout: ms });
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 200));
  });
}

/*
 * Runs in the page. Returns the text elements whose contrast is below `min`.
 * mode 'background': against the element's own composited background colour.
 * mode 'paper':      against white, as printed with background graphics off.
 */
function contrastFailures({ selector, mode, min, skip }) {
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const white = { r: 255, g: 255, b: 255, a: 1 };
  // null when the backdrop includes an image or gradient (can't be judged).
  const background = (el) => {
    if (mode === 'paper') return white;
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none') return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
    }
    return layers.reverse().reduce((acc, c) => over(c, acc), white);
  };
  const opacity = (el) => {
    let o = 1;
    for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  };

  const failures = [];
  for (const el of document.querySelectorAll(selector)) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    if (skip && el.closest(skip)) continue;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!el.getClientRects().length || rect.width <= 1 || cs.visibility === 'hidden') continue;
    const bg = background(el);
    const fg = parse(cs.color);
    if (!bg || !fg || fg.a === 0) continue;   // over an image, or gradient-clipped text
    const text = over({ ...fg, a: fg.a * opacity(el) }, bg);
    const r = ratio(text, bg);
    // WCAG large text (24px, or 18.66px bold) needs 3:1 instead of 4.5:1.
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    if (r < (large ? Math.min(min, 3) : min)) {
      failures.push((el.className || el.tagName) + ' "' + el.textContent.trim().slice(0, 30) + '" ' + r.toFixed(2));
    }
  }
  return failures;
}

/* ==========================================================================
   Regression: behaviour that worked before the fixes and must keep working
   ========================================================================== */

test('page loads with no script errors or CSP violations', async () => {
  const t = await open();
  await scrollThrough(t.page);
  await t.page.waitForTimeout(500);
  assert.deepEqual(t.log.errors, []);
  assert.deepEqual(await t.page.evaluate(() => window.__csp || []), []);
  await close(t);
});

test('every section is revealed after scrolling through the page', async () => {
  const t = await open();
  await scrollThrough(t.page);
  await waitAllRevealed(t.page, 3000);
  await close(t);
});

test('above-the-fold content starts hidden and animates in', async () => {
  const t = await open();
  const marked = await t.page.evaluate(() => document.documentElement.classList.contains('js'));
  assert.ok(marked, 'html.js should be set by the head script');
  await t.page.waitForFunction(() => document.querySelector('#hero-h').classList.contains('is-visible'));
  await close(t);
});

test('theme toggle switches theme, persists, and is restored on reload', async () => {
  const t = await open({ colorScheme: 'dark' });
  const theme = () => t.page.getAttribute('html', 'data-theme');
  assert.equal(await theme(), 'dark');
  await t.page.click('#themeToggle');
  assert.equal(await theme(), 'light');
  assert.equal(await t.page.getAttribute('#themeToggle', 'aria-pressed'), 'true');
  assert.equal(await t.page.evaluate(() => localStorage.getItem('theme')), 'light');
  await t.page.reload();
  assert.equal(await theme(), 'light');
  await close(t);
});

test('mobile menu opens, closes on link click and on Escape', async () => {
  const t = await open({ viewport: { width: 390, height: 844 } });
  const p = t.page;
  await p.click('#menuToggle');
  assert.equal(await p.getAttribute('#menuToggle', 'aria-expanded'), 'true');
  await p.waitForFunction(() => getComputedStyle(document.getElementById('navLinks')).visibility === 'visible');
  await p.click('#navLinks a[href="#skills"]');
  assert.equal(await p.getAttribute('#menuToggle', 'aria-expanded'), 'false');
  await p.click('#menuToggle');
  await p.keyboard.press('Escape');
  assert.equal(await p.getAttribute('#menuToggle', 'aria-expanded'), 'false');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'menuToggle');
  await close(t);
});

test('projects grid filters, sorts and caps the GitHub repos', async () => {
  const t = await open();
  await t.page.waitForSelector('#projectsGrid article');
  const names = await t.page.$$eval('#projectsGrid h3', (h) => h.map((e) => e.textContent));
  assert.deepEqual(names, REPO_ORDER);
  const links = await t.page.$$eval('#projectsGrid a', (as) => as.map((a) => [a.target, a.rel]));
  for (const [target, rel] of links) {
    assert.equal(target, '_blank');
    assert.match(rel, /noopener/);
  }
  assert.equal(await t.page.getAttribute('#projectsGrid', 'aria-busy'), 'false');
  await close(t);
});

test('projects grid shows a fallback when the GitHub API fails', async () => {
  const t = await open({ githubStatus: 403 });
  await t.page.waitForSelector('#projectsGrid .state-msg');
  assert.match(await t.page.textContent('#projectsGrid'), /Couldn't reach the GitHub API/);
  await close(t);
});

test('metric counters finish on their real values', async () => {
  const t = await open();
  await t.page.locator('.metrics').scrollIntoViewIfNeeded();
  await t.page.waitForTimeout(1600);
  const values = await t.page.$$eval('.metrics strong', (s) => s.map((e) => e.textContent));
  assert.deepEqual(values, ['143', '21', '20', '5', '28k']);
  await close(t);
});

test('back-to-top button appears after scrolling and returns to the top', async () => {
  const t = await open();
  assert.equal(await t.page.isHidden('#toTop'), true);
  await t.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await t.page.waitForSelector('#toTop', { state: 'visible' });
  await t.page.click('#toTop');
  await t.page.waitForFunction(() => window.scrollY === 0);
  await close(t);
});

/* ==========================================================================
   Fix: content must stay readable when script.js doesn't run
   ========================================================================== */

async function contactWired(page) {
  await page.focus('#cf-name');
  await page.focus('#cf-email');
  return (await page.getAttribute('#cf-name', 'aria-invalid')) === 'true';
}

test('content stays readable when script.js fails to load', async () => {
  const t = await open({ block: ['/script.js'] });
  await waitAllRevealed(t.page, 4500);
  await close(t);
});

test('content stays readable without IntersectionObserver', async () => {
  const t = await open({ init: 'delete window.IntersectionObserver;' });
  await waitAllRevealed(t.page, 4500);
  assert.deepEqual(t.log.errors, []);
  assert.ok(await contactWired(t.page), 'contact form validation should still be wired');
  await close(t);
});

test('a module that throws does not stop the others', async () => {
  // nav() is the second module; make it throw part-way through.
  const t = await open({ init: 'Element.prototype.prepend = function () { throw new Error("boom"); };' });
  await t.page.waitForFunction(() => document.querySelector('#hero-h').classList.contains('is-visible'));
  await t.page.waitForSelector('#projectsGrid article');
  assert.ok(await contactWired(t.page), 'contact form validation should still be wired');
  await t.page.click('#themeToggle');
  assert.equal(await t.page.getAttribute('html', 'data-theme'), 'dark');
  await close(t);
});

test('the failsafe stays quiet on a healthy page (below-the-fold still animates)', async () => {
  const t = await open();
  await t.page.waitForTimeout(3500);
  assert.ok(await t.page.evaluate(() => document.documentElement.classList.contains('js')));
  const contact = await t.page.$eval('#contactForm', (e) => getComputedStyle(e).opacity);
  assert.equal(contact, '0', 'off-screen sections should still be waiting to animate in');
  await close(t);
});

/* ==========================================================================
   Fix: GitHub data must not be able to inject markup
   ========================================================================== */

test('crafted repo URLs cannot inject attributes or run script', async () => {
  const payload = 'http://x"onfocus="window.__pwned=1"autofocus="/';
  const t = await open({
    repos: [repo('evil', {
      homepage: payload,
      html_url: payload.replace('__pwned=1', '__pwned=2'),
      description: '<img src=x onerror="window.__pwned=3">',
      language: '<b>Py</b>',
    })],
  });
  await t.page.waitForSelector('#projectsGrid article');
  await t.page.waitForTimeout(500);
  const attrs = await t.page.$$eval('#projectsGrid article *', (els) =>
    els.flatMap((e) => e.getAttributeNames()).filter((n) => /^on|autofocus/.test(n)));
  assert.deepEqual(attrs, []);
  assert.equal(await t.page.evaluate(() => window.__pwned), undefined);
  assert.equal(await t.page.$$eval('#projectsGrid img, #projectsGrid b', (e) => e.length), 0);
  await close(t);
});

/* ==========================================================================
   Fix: a corrupted repo cache is ignored, not trusted
   ========================================================================== */

for (const [label, data] of [['an object', { oops: 1 }], ['null entries', [null, 7]], ['no timestamp', undefined]]) {
  test('a cached repo list with ' + label + ' is refetched instead of crashing', async () => {
    const box = data === undefined ? { data: [] } : { at: Date.now(), data };
    const t = await open({ init: `localStorage.setItem('gh:repos:v2', ${JSON.stringify(JSON.stringify(box))});` });
    await t.page.waitForSelector('#projectsGrid article');
    const names = await t.page.$$eval('#projectsGrid h3', (h) => h.map((e) => e.textContent));
    assert.deepEqual(names, REPO_ORDER);
    assert.deepEqual(t.log.errors, []);
    await close(t);
  });
}

test('a valid cached repo list is used without calling the API', async () => {
  const box = { at: Date.now(), data: [repo('from-cache')] };
  const t = await open({ init: `localStorage.setItem('gh:repos:v2', ${JSON.stringify(JSON.stringify(box))});` });
  await t.page.waitForSelector('#projectsGrid article');
  assert.deepEqual(await t.page.$$eval('#projectsGrid h3', (h) => h.map((e) => e.textContent)), ['from-cache']);
  await close(t);
});

/* ==========================================================================
   Fix: the contact form must actually deliver messages (Netlify Forms)
   ========================================================================== */

async function fillForm(page) {
  await page.locator('#contactForm').scrollIntoViewIfNeeded();
  await page.fill('#cf-name', 'Ada Lovelace');
  await page.fill('#cf-email', 'ada@example.com');
  await page.fill('#cf-msg', 'Hello Felix — I have a backend role for you.');
}

test('contact form: invalid input shows errors and sends nothing', async () => {
  const t = await open();
  await t.page.locator('#contactForm').scrollIntoViewIfNeeded();
  await t.page.click('#cfSubmit');
  assert.equal(await t.page.getAttribute('#formStatus', 'class'), 'form-status is-fail');
  for (const id of ['cf-name', 'cf-email', 'cf-msg']) {
    assert.equal(await t.page.isVisible('#' + id + '-err'), true, id + ' error should show');
  }
  assert.equal(await t.page.evaluate(() => document.activeElement.id), 'cf-name');
  assert.equal(t.log.posts.length, 0);
  await close(t);
});

test('contact form: a valid message is posted to Netlify Forms', async () => {
  const t = await open();
  await fillForm(t.page);
  await t.page.click('#cfSubmit');
  await t.page.waitForSelector('#formStatus.is-ok');
  assert.equal(t.log.posts.length, 1);
  const post = t.log.posts[0];
  assert.equal(post.path, '/');
  assert.match(post.type, /application\/x-www-form-urlencoded/);
  const body = Object.fromEntries(new URLSearchParams(post.body));
  assert.deepEqual(body, {
    'form-name': 'contact',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Hello Felix — I have a backend role for you.',
    'bot-field': '',
  });
  assert.equal(await t.page.inputValue('#cf-msg'), '', 'form should reset after sending');
  assert.equal(await t.page.isEnabled('#cfSubmit'), true);
  await close(t);
});

test('contact form: a failed send says so and keeps the message', async () => {
  const t = await open({ formStatus: 404 });
  await fillForm(t.page);
  await t.page.click('#cfSubmit');
  await t.page.waitForSelector('#formStatus.is-fail');
  assert.match(await t.page.textContent('#formStatus'), /oseipokufelix0@gmail\.com/);
  assert.equal(await t.page.inputValue('#cf-msg'), 'Hello Felix — I have a backend role for you.');
  assert.equal(await t.page.isEnabled('#cfSubmit'), true);
  await close(t);
});

test('contact form without JavaScript: native validation and a working POST target', async () => {
  const t = await open({ javaScriptEnabled: false });
  const form = t.page.locator('#contactForm');
  assert.equal(await form.getAttribute('novalidate'), null, 'browser validation must stay on without JS');
  assert.equal(await form.getAttribute('method'), 'POST');
  assert.equal(await form.getAttribute('data-netlify'), 'true');
  assert.equal(await form.getAttribute('netlify-honeypot'), 'bot-field');
  assert.equal(await form.getAttribute('action'), null, 'post back to the page itself');
  assert.equal(await t.page.getAttribute('input[name="form-name"]', 'value'), 'contact');
  assert.equal(await t.page.getAttribute('input[name="bot-field"]', 'tabindex'), '-1');
  // Without JS there is no html.js, so nothing is hidden.
  assert.deepEqual(await hiddenReveals(t.page), []);
  await close(t);
});

test('contact form with JavaScript: custom validation replaces the browser bubbles', async () => {
  const t = await open();
  assert.equal(await t.page.$eval('#contactForm', (f) => f.noValidate), true);
  await close(t);
});

test('contact form without JavaScript: the browser posts it to the page itself', async () => {
  const t = await open({ javaScriptEnabled: false });
  await fillForm(t.page);
  await Promise.all([t.page.waitForNavigation(), t.page.click('#cfSubmit')]);
  assert.equal(t.log.posts.length, 1);
  assert.equal(t.log.posts[0].path, '/');
  const body = Object.fromEntries(new URLSearchParams(t.log.posts[0].body));
  assert.equal(body['form-name'], 'contact');
  assert.equal(body.email, 'ada@example.com');
  await close(t);
});

/* ==========================================================================
   Fix: printing / Save as PDF
   ========================================================================== */

for (const scheme of ['light', 'dark']) {
  test('print (' + scheme + ' theme): every section prints, legibly, on white paper', async () => {
    const t = await open({ colorScheme: scheme });
    await t.page.waitForTimeout(800);
    await t.page.emulateMedia({ media: 'print' });
    // Real printing restyles from scratch; emulation runs the theme's colour
    // transitions (up to 0.3s), so let them settle before measuring.
    await t.page.waitForTimeout(500);
    assert.deepEqual(await hiddenReveals(t.page), [], 'no section may print blank');
    assert.equal(await t.page.$eval('.skip-link', (e) => getComputedStyle(e).display), 'none');
    // Browsers print without background graphics by default, so text is
    // judged against white. Disabled controls are exempt from contrast rules.
    const failures = await t.page.evaluate(contrastFailures, {
      selector: 'body *', mode: 'paper', min: 4.5, skip: '.is-disabled',
    });
    assert.deepEqual(failures, []);
    await close(t);
  });
}

/* ==========================================================================
   Fix: a CSP without 'unsafe-inline'
   ========================================================================== */

function cspDirectives() {
  const csp = headerValue('/', 'Content-Security-Policy');
  return Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
}

test('CSP allows no inline script or inline style', () => {
  const csp = cspDirectives();
  assert.ok(csp['script-src'], 'script-src must be set');
  assert.ok(!csp['script-src'].includes("'unsafe-inline'"), 'script-src: ' + csp['script-src'].join(' '));
  assert.ok(!csp['style-src'].includes("'unsafe-inline'"), 'style-src: ' + csp['style-src'].join(' '));
});

test('markup has no inline scripts, event handlers or style attributes', async () => {
  const t = await open({ javaScriptEnabled: false });
  const found = await t.page.evaluate(() => ({
    scripts: [...document.scripts].filter((s) => !s.src && s.type !== 'application/ld+json').length,
    handlers: [...document.querySelectorAll('*')].flatMap((e) => e.getAttributeNames().filter((n) => n.startsWith('on'))),
    styles: document.querySelectorAll('[style]').length,
  }));
  assert.deepEqual(found, { scripts: 0, handlers: [], styles: 0 });
  await close(t);
});

test('theme and html.js are set before <body> is parsed', async () => {
  const t = await open({
    colorScheme: 'dark',
    init: `localStorage.setItem('theme', 'light');
      new MutationObserver((m, o) => {
        if (!document.body) return;
        window.__atBody = document.documentElement.getAttribute('data-theme') + '|' + document.documentElement.className;
        o.disconnect();
      }).observe(document, { childList: true, subtree: true });`,
  });
  const atBody = await t.page.evaluate(() => window.__atBody);
  assert.match(atBody, /^light\|.*\bjs\b/);
  await close(t);
});

test('web fonts stylesheet is applied under the CSP', async () => {
  const t = await open();
  await t.page.waitForFunction(() => {
    const l = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]');
    return l && l.media === 'all';
  }, null, { timeout: 3000 });
  assert.deepEqual(await t.page.evaluate(() => window.__csp || []), []);
  await close(t);
});

test('project cards get their language gradient under the CSP', async () => {
  const t = await open();
  await t.page.waitForSelector('#projectsGrid article');
  const thumbs = await t.page.$$eval('#projectsGrid .project-thumb', (els) =>
    els.map((e) => [e.textContent.trim(), getComputedStyle(e).backgroundImage]));
  for (const [lang, bg] of thumbs) assert.match(bg, /linear-gradient/, lang + ' thumbnail has no gradient');
  const byLang = Object.fromEntries(thumbs);
  assert.notEqual(byLang.Python, byLang.Go, 'languages keep distinct gradients');
  assert.ok(byLang.Code, 'a repo with no language still renders');
  assert.deepEqual(await t.page.evaluate(() => window.__csp || []), []);
  await close(t);
});

test('web fonts stylesheet is applied when it arrives after script.js', async () => {
  // DOMContentLoaded: script.js has run, the stylesheet is still on its way.
  const t = await open({ fontDelay: 1500, waitUntil: 'domcontentloaded' });
  const media = () => t.page.$eval('#fontCss', (l) => l.media);
  assert.equal(await media(), 'print', 'still loading: must not block or apply yet');
  await t.page.waitForFunction(() => document.getElementById('fontCss').media === 'all', null, { timeout: 5000 });
  await close(t);
});

/* ==========================================================================
   Fix: WCAG AA contrast (4.5:1, or 3:1 for large text) in both themes
   ========================================================================== */

for (const scheme of ['light', 'dark']) {
  test('contrast (' + scheme + '): form errors and status messages meet AA', async () => {
    const t = await open({ colorScheme: scheme, formStatus: 404 });
    await t.page.locator('#contactForm').scrollIntoViewIfNeeded();
    await t.page.waitForTimeout(1200);
    const check = async (what) => {
      await t.page.waitForTimeout(400);  // colour transitions
      const f = await t.page.evaluate(contrastFailures, { selector: '#contactForm *', mode: 'background', min: 4.5 });
      assert.deepEqual(f, [], what);
    };
    await t.page.click('#cfSubmit');   // empty → field errors + failure status
    await check('validation errors');
    await fillForm(t.page);
    await t.page.click('#cfSubmit');   // endpoint 404 → failure status
    await t.page.waitForSelector('#formStatus.is-fail:not(:empty)');
    await check('send failure');
    await t.context.unroute('**/*');
    await t.context.route('**/*', (route) => serve(route, {}, t.log));
    await fillForm(t.page);
    await t.page.click('#cfSubmit');   // endpoint 200 → success status
    await t.page.waitForSelector('#formStatus.is-ok');
    await check('success');
    await close(t);
  });

  test('contrast (' + scheme + '): all visible text on screen meets AA', async () => {
    const t = await open({ colorScheme: scheme });
    await scrollThrough(t.page);
    await waitAllRevealed(t.page, 3000);
    await t.page.waitForTimeout(300);
    const failures = await t.page.evaluate(contrastFailures, {
      selector: 'body *', mode: 'background', min: 4.5, skip: '.is-disabled',
    });
    assert.deepEqual(failures, []);
    await close(t);
  });
}

/* ==========================================================================
   Fix: _headers rules must not overlap
   ========================================================================== */

const PATHS = ['/', '/index.html', '/style.css', '/script.js', '/theme-init.js', '/assets/og-image.png'];
const SECURITY = ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy',
  'Strict-Transport-Security', 'Content-Security-Policy'];

test('no header is set twice for any path (Netlify would merge the values)', () => {
  for (const p of PATHS) {
    const names = headersFor(p).map(([n]) => n.toLowerCase());
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepEqual(dupes, [], 'duplicated on ' + p);
  }
});

test('every path gets the full set of security headers', () => {
  for (const p of PATHS) {
    for (const h of SECURITY) assert.ok(headerValue(p, h), h + ' missing on ' + p);
  }
});

test('Permissions-Policy lists only features browsers recognise', () => {
  assert.doesNotMatch(headerValue('/', 'Permissions-Policy'), /interest-cohort/);
});

/* ==========================================================================
   Fix: a deploy must reach returning visitors (cache busting)
   ========================================================================== */

const crypto = require('node:crypto');
const VERSIONED = ['style.css', 'script.js', 'theme-init.js'];

test('staged HTML references CSS/JS by content hash', () => {
  const html = fs.readFileSync(path.join(DEPLOY, 'index.html'), 'utf8');
  for (const f of VERSIONED) {
    const v = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 10);
    assert.ok(html.includes('"' + f + '?v=' + v + '"'), f + ' should be referenced as ' + f + '?v=' + v);
  }
});

test('versioned CSS/JS are cached long-term; HTML always revalidates', () => {
  for (const f of VERSIONED) {
    assert.match(headerValue('/' + f, 'Cache-Control'), /max-age=31536000.*immutable/, f);
  }
  assert.match(headerValue('/', 'Cache-Control'), /max-age=0, must-revalidate/);
});

// Runs stage.sh against a throwaway copy of the site, after `mutate(dir)`;
// `inspect(dir)` can look at the result before the copy is removed.
function stageCopy(mutate, inspect) {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'stage-'));
  for (const f of ['index.html', 'style.css', 'script.js', 'theme-init.js', 'site.webmanifest',
    'robots.txt', 'sitemap.xml', '_headers', 'stage.sh']) {
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  fs.cpSync(path.join(ROOT, 'assets'), path.join(dir, 'assets'), { recursive: true });
  if (mutate) mutate(dir);
  const r = spawnSync('bash', ['stage.sh'], { cwd: dir, encoding: 'utf8' });
  if (inspect) inspect(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  return { status: r.status, out: r.stdout + r.stderr };
}

test('stage.sh refuses to publish when a CSS/JS reference cannot be versioned', () => {
  const r = stageCopy((dir) => {
    const f = path.join(dir, 'index.html');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('src="script.js"', "src='script.js'"));
  });
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /ERROR: index.html has no "script\.js" reference/);
});

/* ==========================================================================
   Fix: publish only the assets the site references
   ========================================================================== */

function referencedAssets(dir) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const text = html + fs.readFileSync(path.join(dir, 'site.webmanifest'), 'utf8');
  return [...new Set([...text.matchAll(/assets\/([\w.-]+\.(?:png|ico|jpg|webp|svg))/g)].map((m) => m[1]))].sort();
}

test('the publish folder holds exactly the referenced assets', () => {
  const published = fs.readdirSync(path.join(DEPLOY, 'assets')).sort();
  assert.deepEqual(published, referencedAssets(ROOT));
  assert.ok(!published.includes('laundromart-desktop-login.png'), 'unused admin sign-in capture is published');
});

test('an image is published as soon as the page references it', () => {
  let published;
  const r = stageCopy((dir) => {
    // Uncomment the second phone mock-up, as the TODO in index.html describes.
    const f = path.join(dir, 'index.html');
    const html = fs.readFileSync(f, 'utf8').replace(/<!-- TODO: add a second capture[\s\S]*?:\n([\s\S]*?)-->/,
      (m, figure) => figure);
    assert.match(html, /^\s*<figure class="mock-phone mock-phone--back">/m);
    fs.writeFileSync(f, html);
  }, (dir) => { published = fs.readdirSync(path.join(dir, '_deploy', 'assets')); });
  assert.equal(r.status, 0, r.out);
  assert.ok(published.includes('laundromart-mobile-2.png'));
  assert.ok(!published.includes('laundromart-desktop-login.png'));
});

/* ==========================================================================
   Fix: the "Case study — soon" placeholder is not a live control
   ========================================================================== */

test('the case-study placeholder is skipped by keyboard and is not a link', async () => {
  const t = await open();
  const ph = t.page.locator('.featured-cta .is-disabled');
  assert.equal(await ph.evaluate((e) => e.matches('a[href], button, [tabindex]:not([tabindex="-1"])')), false);
  await t.page.focus('.featured-cta a[href*="laundromart-"]');   // "Source code", just before it
  await t.page.keyboard.press('Tab');
  assert.doesNotMatch(await t.page.evaluate(() => document.activeElement.textContent), /Case study/);
  assert.match(await ph.textContent(), /Case study — soon/);
  await close(t);
});

/* ==========================================================================
   Fix: project order is well defined, and the caption describes it
   ========================================================================== */

test('repos without a push date sort last instead of scrambling the order', async () => {
  const missing = repo('missing');
  delete missing.pushed_at;   // field absent → new Date(undefined) → NaN
  const t = await open({
    repos: [
      missing,
      repo('nodate', { pushed: null }),
      repo('e1', { pushed: '2026-06-01T00:00:00Z' }),
      repo('starred-undated', { stars: 3, pushed: null }),
      repo('beta', { pushed: '2026-09-01T00:00:00Z' }),
      repo('starred', { stars: 3, pushed: '2026-01-01T00:00:00Z' }),
    ],
  });
  await t.page.waitForSelector('#projectsGrid article');
  const names = await t.page.$$eval('#projectsGrid h3', (h) => h.map((e) => e.textContent));
  assert.deepEqual(names.slice(0, 4), ['starred', 'starred-undated', 'beta', 'e1']);
  assert.deepEqual(names.slice(4).sort(), ['missing', 'nodate']);
  assert.doesNotMatch(await t.page.textContent('#projectsGrid'), /Invalid Date|NaN/);
  await close(t);
});

test('the projects caption matches the sort order', async () => {
  const t = await open();
  const caption = await t.page.textContent('#projects .section-sub');
  assert.doesNotMatch(caption, /newest first/i, 'cards are ordered by stars, then by last push');
  assert.match(caption, /star/i);
  await close(t);
});

/* ==========================================================================
   Fix: the maskable app icon is full-bleed
   ========================================================================== */

test('maskable manifest icon is opaque to the edges', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DEPLOY, 'site.webmanifest'), 'utf8'));
  const maskable = manifest.icons.filter((i) => i.purpose.split(' ').includes('maskable'));
  assert.equal(maskable.length, 1);
  const t = await open();
  const px = await t.page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const alpha = (x, y) => g.getImageData(x, y, 1, 1).data[3];
    const w = img.width - 1;
    return { size: img.width + 'x' + img.height, corners: [alpha(0, 0), alpha(w, 0), alpha(0, w), alpha(w, w)] };
  }, maskable[0].src);
  assert.equal(px.size, maskable[0].sizes);
  assert.deepEqual(px.corners, [255, 255, 255, 255], 'Android masks the icon to its own shape; transparent corners show as black or white');
  await close(t);
});
