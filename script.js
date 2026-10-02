/* ============================================================================
   Felix Osei-Poku — Portfolio
   ----------------------------------------------------------------------------
   Modules
     theme()        Theme toggle (head script does the first paint; this syncs)
     nav()          Mobile menu, sticky state, active-link highlighting
     scrollFx()     ONE rAF-gated scroll listener: progress bar + back-to-top
     reveal()       IntersectionObserver fade-ins with stagger
     counters()     Count-up animation for the metric strip
     magnetic()     Subtle pointer-follow on primary buttons
     projects()     GitHub repos, escaped + cached in localStorage
     contact()      Client-side validation, Formspree POST, mailto fallback
     misc()         Footer year

   Conventions
     · No inline styles that duplicate CSS — hover/visual state lives in CSS.
     · Every scroll-dependent read happens inside one requestAnimationFrame.
     · All interpolated remote data goes through escapeHtml().
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -- helpers ------------------------------------------------------------ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** Escape untrusted text before it touches innerHTML. */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Only allow http(s) URLs through to an href. */
  function safeUrl(value) {
    try {
      var u = new URL(value, window.location.origin);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
    } catch (e) { return ''; }
  }


  /* ======================================================================
     THEME
     The <head> script already applied the correct theme before first paint.
     This only keeps the button's label/state in sync and handles clicks.
     ====================================================================== */

  function theme() {
    var btn = $('#themeToggle');
    var root = document.documentElement;
    if (!btn) return;

    function sync() {
      var isLight = root.getAttribute('data-theme') === 'light';
      btn.setAttribute('aria-pressed', String(isLight));
      btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    }

    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
      sync();
    });

    // Follow the OS only while the visitor hasn't made an explicit choice.
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var onChange = function (e) {
      var chosen = null;
      try { chosen = localStorage.getItem('theme'); } catch (err) { /* ignore */ }
      if (chosen) return;
      root.setAttribute('data-theme', e.matches ? 'light' : 'dark');
      sync();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);

    sync();
  }


  /* ======================================================================
     NAVIGATION
     ====================================================================== */

  function nav() {
    var header = $('#nav');
    var toggle = $('#menuToggle');
    var list = $('#navLinks');
    if (!header || !toggle || !list) return;

    function setMenu(open) {
      list.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    toggle.addEventListener('click', function () {
      setMenu(!list.classList.contains('is-open'));
    });

    list.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && list.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!list.classList.contains('is-open')) return;
      if (!list.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
    });

    // Without IntersectionObserver the menu still works; the sticky
    // background and active-link highlight are skipped.
    if (!('IntersectionObserver' in window)) return;

    // Sticky background — observed rather than measured on every scroll tick.
    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { rootMargin: '-8px 0px 0px 0px' }).observe(sentinel);

    // Active link — the section occupying the middle of the viewport wins.
    var links = $$('a[href^="#"]', list);
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

    var sections = Object.keys(byId)
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);

    if (sections.length) {
      var visible = {};
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });

        var current = null;
        for (var i = 0; i < sections.length; i++) {
          if (visible[sections[i].id]) { current = sections[i].id; break; }
        }
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

      sections.forEach(function (s) { spy.observe(s); });
    }
  }


  /* ======================================================================
     SCROLL EFFECTS — one listener, one rAF, two readers
     ====================================================================== */

  function scrollFx() {
    var bar = $('#scrollProgress');
    var toTop = $('#toTop');
    var ticking = false;

    function frame() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      var max = document.documentElement.scrollHeight - window.innerHeight;

      if (bar) bar.style.width = (max > 0 ? Math.min(y / max, 1) * 100 : 0) + '%';
      if (toTop) toTop.hidden = y < window.innerHeight * 0.9;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }, { passive: true });

    window.addEventListener('resize', frame, { passive: true });
    frame();

    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  }


  /* ======================================================================
     REVEAL ON SCROLL
     ====================================================================== */

  var revealObserver = null;

  function reveal() {
    var items = $$('.reveal');

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      document.documentElement.classList.add('reveal-ready');
      return;
    }

    revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-visible');
        obs.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    items.forEach(function (el) {
      // Explicit delay wins; otherwise stagger by position within the parent.
      if (!el.style.getPropertyValue('--d')) {
        var explicit = el.getAttribute('data-reveal-delay');
        var index = explicit !== null
          ? explicit
          : Math.min(Array.prototype.indexOf.call(el.parentElement.children, el), 6);
        el.style.setProperty('--d', index);
      }
      revealObserver.observe(el);
    });

    // Tells the head script's failsafe that reveal is in charge now.
    document.documentElement.classList.add('reveal-ready');

    // Failsafe: if the observer never reports (some embedded//non-compositing
    // webviews never run IO callbacks), show everything rather than leave the
    // page blank.
    setTimeout(function () {
      if (!document.querySelector('.reveal.is-visible')) {
        $$('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
      }
    }, 2500);
  }

  /**
   * Register nodes created after the initial reveal() pass.
   *
   * Late-injected targets rely on a second observer delivery, which some
   * engines never schedule (and headless renders skip entirely) — leaving the
   * nodes stuck at opacity 0. Observe for the nice scroll-triggered stagger,
   * but back it with a short timer so content can never be silently invisible.
   */
  function observeReveal(nodes) {
    nodes.forEach(function (el, i) {
      el.style.setProperty('--d', Math.min(i, 6));
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add('is-visible');
    });

    setTimeout(function () {
      nodes.forEach(function (el) { el.classList.add('is-visible'); });
    }, 1200);
  }


  /* ======================================================================
     METRIC COUNT-UP
     ====================================================================== */

  function counters() {
    var nodes = $$('[data-count]');
    if (!nodes.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) return; // keep static markup

    var obs = new IntersectionObserver(function (entries, o) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        o.unobserve(en.target);

        var el = en.target;
        var target = parseInt(el.getAttribute('data-count'), 10);
        var suffix = el.textContent.replace(/[\d\s,]/g, '');   // keeps "k", "+", "%"
        var start = performance.now();
        var dur = 1100;

        (function step(now) {
          var p = Math.min((now - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(step);
        })(start);
      });
    }, { threshold: 0.5 });

    nodes.forEach(function (n) { obs.observe(n); });
  }


  /* ======================================================================
     MAGNETIC BUTTONS
     ====================================================================== */

  function magnetic() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    $$('.magnetic').forEach(function (el) {
      var raf = null;

      el.addEventListener('pointermove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = el.getBoundingClientRect();
          var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
          var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          el.style.transform = 'translate(' + (dx * 7).toFixed(2) + 'px,' + (dy * 7).toFixed(2) + 'px)';
        });
      });

      el.addEventListener('pointerleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        el.style.transform = '';
      });
    });
  }


  /* ======================================================================
     GITHUB PROJECTS
     ====================================================================== */

  var GH_USER = 'Felix-Dcc';
  var GH_URL = 'https://api.github.com/users/' + GH_USER + '/repos?sort=updated&per_page=100';
  var CACHE_KEY = 'gh:repos:v2';
  var CACHE_TTL = 6 * 60 * 60 * 1000;               // 6 hours — API allows 60 req/hr per IP
  var MAX_CARDS = 6;

  // Repos handled elsewhere on the page, or not worth showing.
  var EXCLUDE = ['laundromart-'];                    // featured in its own section
  // TODO: add repo names here to hide them, e.g. 'Hello-World'

  var LANG_STYLE = {
    'Python':     { grad: 'linear-gradient(140deg,#3776ab,#ffd43b)' },
    'Go':         { grad: 'linear-gradient(140deg,#00add8,#5dc9e2)' },
    'JavaScript': { grad: 'linear-gradient(140deg,#f7df1e,#e2b714)' },
    'TypeScript': { grad: 'linear-gradient(140deg,#3178c6,#235a97)' },
    'HTML':       { grad: 'linear-gradient(140deg,#e34c26,#f06529)' },
    'CSS':        { grad: 'linear-gradient(140deg,#264de4,#2965f1)' },
    'Java':       { grad: 'linear-gradient(140deg,#007396,#ed8b00)' },
    'C++':        { grad: 'linear-gradient(140deg,#00599c,#004482)' },
    'C':          { grad: 'linear-gradient(140deg,#555,#a8b9cc)' },
    'Shell':      { grad: 'linear-gradient(140deg,#89e051,#4e9a06)' },
    'Dockerfile': { grad: 'linear-gradient(140deg,#0db7ed,#0a6a9c)' },
    'default':    { grad: 'linear-gradient(140deg,#6366f1,#a78bfa)' }
  };

  function skeletonMarkup() {
    return '' +
      '<div class="card project skeleton" aria-hidden="true">' +
      '  <div class="sk-thumb"></div>' +
      '  <div class="sk-body">' +
      '    <div class="sk-line sk-w-60"></div>' +
      '    <div class="sk-line sk-w-100"></div>' +
      '    <div class="sk-line sk-w-80"></div>' +
      '  </div>' +
      '</div>';
  }

  function cardMarkup(repo) {
    var lang = repo.language || 'Code';
    var style = LANG_STYLE[repo.language] || LANG_STYLE['default'];
    var repoUrl = safeUrl(repo.html_url);
    var homepage = repo.homepage ? safeUrl(repo.homepage) : '';
    var updated = repo.pushed_at ? new Date(repo.pushed_at) : null;
    var when = updated
      ? updated.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      : '';

    return '' +
      '<article class="card project reveal">' +
      '  <div class="project-thumb" style="background:' + style.grad + '">' +
      '    <span class="project-lang">' + escapeHtml(lang) + '</span>' +
      '  </div>' +
      '  <div class="project-body">' +
      '    <h3>' + escapeHtml(repo.name) + '</h3>' +
      '    <p>' + escapeHtml(repo.description || 'No description yet — add one on GitHub so this card reads well.') + '</p>' +
      '    <div class="project-meta">' +
      (repo.stargazers_count ? '<span>★ ' + escapeHtml(repo.stargazers_count) + '</span>' : '') +
      (when ? '<span>Updated ' + escapeHtml(when) + '</span>' : '') +
      '    </div>' +
      '    <div class="project-links">' +
      (repoUrl ? '<a href="' + repoUrl + '" target="_blank" rel="noopener noreferrer">GitHub</a>' : '') +
      (homepage ? '<a href="' + homepage + '" target="_blank" rel="noopener noreferrer">Live demo</a>' : '') +
      '    </div>' +
      '  </div>' +
      '</article>';
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var box = JSON.parse(raw);
      if (Date.now() - box.at > CACHE_TTL) return null;
      return box.data;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); }
    catch (e) { /* quota or private mode — cache is optional */ }
  }

  function renderRepos(grid, repos) {
    var list = repos
      .filter(function (r) { return !r.fork && !r.archived; })
      .filter(function (r) { return EXCLUDE.indexOf(r.name) === -1; })
      .sort(function (a, b) {
        return (b.stargazers_count - a.stargazers_count) ||
               (new Date(b.pushed_at) - new Date(a.pushed_at));
      })
      .slice(0, MAX_CARDS);

    grid.setAttribute('aria-busy', 'false');

    if (!list.length) {
      grid.innerHTML =
        '<div class="state-msg">' +
        '  <p>Nothing else public yet — my main work is the featured project above.</p>' +
        '  <a class="btn btn-ghost" href="https://github.com/' + GH_USER + '" target="_blank" rel="noopener noreferrer">Visit GitHub</a>' +
        '</div>';
      return;
    }

    grid.innerHTML = list.map(cardMarkup).join('');
    observeReveal($$('.reveal', grid));
  }

  function projects() {
    var grid = $('#projectsGrid');
    if (!grid) return;

    var cached = readCache();
    if (cached) { renderRepos(grid, cached); return; }

    grid.innerHTML = new Array(3).join('|').split('|').map(skeletonMarkup).join('');

    fetch(GH_URL, { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('GitHub responded ' + res.status);
        return res.json();
      })
      .then(function (repos) {
        if (!Array.isArray(repos)) throw new Error('Unexpected payload');
        // Store only what the card needs — keeps the cache small.
        var slim = repos.map(function (r) {
          return {
            name: r.name, description: r.description, language: r.language,
            html_url: r.html_url, homepage: r.homepage, pushed_at: r.pushed_at,
            stargazers_count: r.stargazers_count, fork: r.fork, archived: r.archived
          };
        });
        writeCache(slim);
        renderRepos(grid, slim);
      })
      .catch(function (err) {
        console.warn('[projects]', err.message);
        grid.setAttribute('aria-busy', 'false');
        grid.innerHTML =
          '<div class="state-msg">' +
          '  <p>Couldn\'t reach the GitHub API just now — it rate-limits anonymous requests.</p>' +
          '  <a class="btn btn-ghost" href="https://github.com/' + GH_USER + '" target="_blank" rel="noopener noreferrer">Browse the repositories</a>' +
          '</div>';
      });
  }


  /* ======================================================================
     CONTACT FORM
     ====================================================================== */

  var MAILTO = 'oseipokufelix0@gmail.com';

  function contact() {
    var form = $('#contactForm');
    if (!form) return;

    var status = $('#formStatus');
    var submit = $('#cfSubmit');

    var rules = [
      { id: 'cf-name',  test: function (v) { return v.trim().length > 1; } },
      { id: 'cf-email', test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); } },
      { id: 'cf-msg',   test: function (v) { return v.trim().length > 9; } }
    ];

    function setFieldError(input, invalid) {
      var field = input.closest('.field');
      var err = $('#' + input.id + '-err');
      if (field) field.classList.toggle('has-error', invalid);
      if (err) err.hidden = !invalid;
      input.setAttribute('aria-invalid', String(invalid));
    }

    function validate(showAll) {
      var firstBad = null;
      rules.forEach(function (rule) {
        var input = document.getElementById(rule.id);
        if (!input) return;
        var ok = rule.test(input.value);
        if (showAll || input.dataset.touched === '1') setFieldError(input, !ok);
        if (!ok && !firstBad) firstBad = input;
      });
      return firstBad;
    }

    rules.forEach(function (rule) {
      var input = document.getElementById(rule.id);
      if (!input) return;
      input.addEventListener('blur', function () { input.dataset.touched = '1'; validate(false); });
      input.addEventListener('input', function () {
        if (input.dataset.touched === '1') validate(false);
      });
    });

    function say(msg, kind) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'form-status' + (kind ? ' is-' + kind : '');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var bad = validate(true);
      if (bad) { bad.focus(); say('Please fix the highlighted fields.', 'fail'); return; }

      var action = form.getAttribute('action') || '';
      var configured = action.indexOf('YOUR_FORM_ID') === -1 && /^https?:/.test(action);

      // Not wired to a form service yet → hand off to the visitor's mail client.
      if (!configured) {
        var subject = encodeURIComponent('Portfolio enquiry from ' + $('#cf-name').value.trim());
        var body = encodeURIComponent(
          $('#cf-msg').value.trim() + '\n\n— ' + $('#cf-name').value.trim() + ' (' + $('#cf-email').value.trim() + ')'
        );
        window.location.href = 'mailto:' + MAILTO + '?subject=' + subject + '&body=' + body;
        say('Opening your email app…');
        return;
      }

      submit.disabled = true;
      var label = submit.textContent;
      submit.textContent = 'Sending…';
      say('');

      fetch(action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Status ' + res.status);
          form.reset();
          rules.forEach(function (r) {
            var i = document.getElementById(r.id);
            if (i) { i.dataset.touched = '0'; setFieldError(i, false); }
          });
          say('Thanks — message sent. I\'ll reply within a day or two.', 'ok');
        })
        .catch(function () {
          say('Something went wrong. Email me directly at ' + MAILTO + '.', 'fail');
        })
        .then(function () {
          submit.disabled = false;
          submit.textContent = label;
        });
    });
  }


  /* ======================================================================
     MISC
     ====================================================================== */

  function misc() {
    var year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }


  /* ======================================================================
     BOOT
     ====================================================================== */

  // Each module runs in isolation: one that throws is logged and skipped,
  // and never takes the contact form or the reveal down with it.
  function init() {
    [theme, nav, scrollFx, reveal, counters, magnetic, projects, contact, misc]
      .forEach(function (module) {
        try { module(); }
        catch (e) { console.error('[' + module.name + ']', e); }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
