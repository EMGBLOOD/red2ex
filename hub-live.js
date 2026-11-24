/* hub-live.js - fills the Project hub from data.json and changelog.json (both written by refresh_site.ps1).
   Place the three files next to the exported pages. All text goes in with textContent, never innerHTML.
   Cards: .game with data-game="d1" / "d2" (else first = Driver 1, second = Driver 2).
   Releases list: <dl class="rel">.  Changelog: <div id="hub-changelog">.
   If a file cannot be read the page keeps what it was exported with.
   Schema 3 (2026-11-24): data.json also has built (UTC time), commit and games.<d1|d2> = { weekDone, lastDone[], commitsToday, commitsWeek, working[] }; data without these keys
   (schema 2) still renders as before, and a page of an older version ignores them. */
(function () {
  'use strict';
  var SKIP = { 'RD1-HUB-SPLIT': 1 };   /* counted, not listed (internal wording) */
  var ORDER = { now: 0, testing: 0, hold: 1, planned: 2, done: 3 };
  var MAX_ROWS = 10, MORE_DONE = 0, TOP_DONE = 0;   /* finished work is in the changelog, the cards list only what is not done */   /* rows shown at first; finished rows added when the list is opened */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function tally(items, game) {
    var t = { done: 0, act: 0, next: 0 };
    items.forEach(function (i) {
      if (i.game !== game) return;
      if (i.status === 'done') t.done++;
      else if (i.status === 'planned') t.next++;
      else t.act++;                         /* now, hold, testing */
    });
    t.total = t.done + t.act + t.next;
    return t;
  }
  function pct(n, total) { return (Math.round(n / total * 1000) / 10) + '%'; }

  function setCounts(card, t, ofSteps) {
    var stat = card.querySelectorAll('.stat > div');
    if (stat.length >= 3) {
      [t.done, t.act, t.next].forEach(function (v, k) { stat[k].querySelector('b').textContent = String(v); });
      if (ofSteps) stat[0].querySelector('span').textContent = 'of ' + t.total + ' steps done';
      else stat[0].querySelector('span').textContent = 'steps done';
    }
    var bar = card.querySelector('.bar');
    if (bar && !t.total) bar.querySelectorAll('i').forEach(function (s) { s.style.width = '0'; });
    if (bar && t.total) {
      var segs = bar.querySelectorAll('i');
      if (segs.length >= 3) {
        segs[0].style.width = pct(t.done, t.total);
        segs[1].style.width = pct(t.act, t.total);
        segs[2].style.width = pct(t.next, t.total);
      }
      bar.setAttribute('aria-label', t.done + ' of ' + t.total + ' done, ' + t.act + ' under way, ' + t.next + ' queued');
    }
  }
  function tagText(s) { return s === 'done' ? 'Done' : (s === 'planned' ? 'Queued' : (s === 'hold' ? 'On hold' : 'Under way')); }
  /* the stage progress of a job: ticked stages (done = full, partly = half) of all stages */
  function stageBar(it) {
    var w = Math.min(100, Math.round(((it.done || 0) + (it.partly || 0) * 0.5) / it.total * 100));
    var bar = el('span', 'hp-bar');
    var fill = el('i');
    fill.style.width = w + '%';
    bar.appendChild(fill);
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', (it.done || 0) + ' of ' + it.total + ' stages done');
    return bar;
  }
  function row(it) {
    var st = it.status === 'done' ? 'ok' : ((it.status === 'planned' || it.status === 'hold') ? '' : 'act');
    var li = el('li', st ? 's-' + st : '');
    li.appendChild(el('span', 'dot'));
    var d = el('div', '', it.title);
    var note = it.text || '';
    if (it.total > 0 && it.status !== 'done') note += (note ? ' ' : '') + it.done + ' of ' + it.total + ' stages done.';
    if (note) d.appendChild(el('small', '', note));
    if (it.total > 0 && it.status !== 'done') d.appendChild(stageBar(it));
    li.appendChild(d);
    li.appendChild(el('span', 'tag', tagText(it.status)));
    return li;
  }
  function setRows(card, items, game) {
    var ul = card.querySelector('ul.ms');
    if (!ul) return;
    var list = items.filter(function (i) { return i.game === game && !SKIP[i.id] && !i.bug && !/owner's|^DEBT/i.test(i.title); });
    /* the newest finished ones first, then under way, on hold and queued, then the older finished ones */
    list.sort(function (a, b) { return (ORDER[a.status] - ORDER[b.status]) || String(b.date || b.added || '').localeCompare(String(a.date || a.added || '')); });
    var finished = list.filter(function (i) { return i.status === 'done'; }).sort(function (a, b) { return (a.area === 'behind') - (b.area === 'behind'); });   /* player facing first */
    var open = list.filter(function (i) { return i.status !== 'done'; });
    list = open;
    var rest = list.slice(MAX_ROWS), doneKept = 0;
    rest = rest.filter(function (i) { return i.status !== 'done' || ++doneKept <= MORE_DONE; });
    clear(ul);
    if (!list.length) { var e = el('li', 'empty'); e.style.display = 'block'; e.style.padding = '14px 0'; e.style.color = 'var(--dim)'; e.appendChild(el('span', 'dim', 'No big steps are lined up yet. The next ones will appear here once they are planned.')); ul.appendChild(e); return; }
    list.slice(0, MAX_ROWS).forEach(function (i) { ul.appendChild(row(i)); });
    if (rest.length) {
      var li = el('li', 'more'), det = el('details'), sum = el('summary', '', 'Show ' + rest.length + ' more'), inner = el('ul', 'ms');
      det.addEventListener('toggle', function () { sum.textContent = det.open ? 'Show fewer' : 'Show ' + inner.children.length + ' more'; });
      rest.forEach(function (i) { inner.appendChild(row(i)); });
      det.appendChild(sum); det.appendChild(inner); li.appendChild(det); ul.appendChild(li);
    }
  }
  function cardFor(cards, game, idx) {
    for (var k = 0; k < cards.length; k++) if (cards[k].getAttribute('data-game') === game) return cards[k];
    return cards[idx] || null;
  }


  /* when one card is shorter than its neighbour, the entries that were folded under "Show more" are shown in the open instead, as many as fit */
  function listEnd(card) { var u = card.querySelector('ul.ms'); if (!u) return 0; var r = u.getBoundingClientRect(); return r.bottom + window.pageYOffset; }
  function balance(cards) {
    if (cards.length < 2 || !cards[0] || !cards[1]) return;
    if (Math.abs(cards[0].getBoundingClientRect().top - cards[1].getBoundingClientRect().top) > 20) return;   /* stacked on a phone: nothing to match */
    var order = listEnd(cards[0]) <= listEnd(cards[1]) ? [0, 1] : [1, 0];
    var sh = cards[order[0]], tallEnd = listEnd(cards[order[1]]);
    var more = sh.querySelector('ul.ms > li.more'), inner = more && more.querySelector('ul.ms'), sum = more && more.querySelector('summary');
    if (!inner) return;
    var det = more.querySelector('details');
    while (inner.firstElementChild) {
      var li = inner.firstElementChild;
      more.parentNode.insertBefore(li, more);
      if (listEnd(sh) > tallEnd + 4) { inner.insertBefore(li, inner.firstChild); break; }
    }
    if (!inner.firstElementChild) more.parentNode.removeChild(more);
    else if (sum && !det.open) sum.textContent = 'Show ' + inner.children.length + ' more';
  }

  /* Silex removes style rules no static element uses, so the changelog look lives here */
  (function addStyle() {
    var st = document.createElement('style');
    st.textContent =
      '.cl{border-top:1px solid var(--line);padding:6px 0}' +
      '.cl summary{cursor:pointer;display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;padding:12px 0;list-style:none}' +
      '.cl summary::-webkit-details-marker{display:none}' +
      '.clv{font:italic 800 28px var(--head)}.cld{color:var(--dim);font-size:14px}' +
      '.clc{margin-left:auto;font:500 12px var(--mono);color:var(--dim)}' +
      '.clh{font:700 13px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--red-ink);margin:22px 0 6px}' +
      '.ms li.more{display:block;padding:9px 0}.ms li.more summary{cursor:pointer;font:500 12px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--red-ink)}.ms li.more ul.ms{margin-top:8px}' +
      '.hp-bar{display:block;height:5px;margin-top:6px;background:var(--line);border-radius:3px;overflow:hidden}.hp-bar i{display:block;height:100%;background:var(--red-ink)}' +
      '.hp{margin:14px 0 6px;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}' +
      '.hp h4{margin:0 0 6px;font:700 12px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--red-ink)}' +
      '.hp .hp-row{display:flex;gap:18px;flex-wrap:wrap;font:500 13px var(--mono);color:var(--fg);margin:0 0 8px}.hp .hp-row b{font-size:18px}' +
      '.hp ul{margin:0 0 8px;padding:0;list-style:none}.hp li{display:flex;gap:10px;justify-content:space-between;align-items:baseline;padding:3px 0;font-size:14px;overflow-wrap:anywhere}' +
      '.hp li small{color:var(--dim);font:500 12px var(--mono);white-space:nowrap}.hp li div{flex:1;min-width:0}' +
      '#hub-fresh{font:500 13px var(--mono);color:var(--dim);margin:8px 0}#hub-fresh.hp-warn{color:var(--red-ink);font-weight:700}' +
      '.cll{margin:0;padding-left:20px}.cll li{margin:6px 0;color:var(--fg);font-size:15px;overflow-wrap:anywhere}';
    document.head.appendChild(st);
  })();

  /* releases and changelog */
  function countLines(v) { return v.sections.reduce(function (n, s) { return n + s.lines.length; }, 0); }
  function renderReleases(dl, C) {
    clear(dl);
    C.versions.slice(0, 2).forEach(function (v) {
      var dt = el('dt', '', v.version.replace('-beta', ' beta') + (v.status ? ' ' + v.status.replace(/^\(|\)$/g, '') : ''));
      var names = v.sections.map(function (s) { return s.title; });
      dl.appendChild(dt);
      dl.appendChild(el('dd', '', countLines(v) + ' changes: ' + names.join(', ') + '.'));
    });
  }
  function fillVersion(det, v) {
    v.sections.forEach(function (s) {
      det.appendChild(el('h3', 'clh', s.title));
      var ul = el('ul', 'cll');
      s.lines.forEach(function (l) { ul.appendChild(el('li', '', l)); });
      det.appendChild(ul);
    });
  }
  function renderChangelog(box, C) {
    clear(box);
    C.versions.forEach(function (v, k) {
      var det = el('details', 'cl');
      var sum = el('summary');
      sum.appendChild(el('span', 'clv', v.version));
      sum.appendChild(el('span', 'cld', v.status.replace(/^\(|\)$/g, '') || ''));
      sum.appendChild(el('span', 'clc', countLines(v) + ' changes'));
      det.appendChild(sum);
      var filled = false;
      function open() { if (!filled) { filled = true; fillVersion(det, v); } }
      det.addEventListener('toggle', function () { if (det.open) open(); });
      if (k === 0) { det.open = true; open(); }
      box.appendChild(det);
    });
  }
  /* the daily progress of one game card (schema 3): finished this week, commits, working on right now */
  function panel(card, g) {
    var old = card.querySelector('.hp');
    if (old) old.parentNode.removeChild(old);
    if (!g) return;
    var box = el('div', 'hp');
    box.appendChild(el('h4', '', 'This week'));
    var nums = el('div', 'hp-row');
    [[g.weekDone, 'finished'], [g.commitsToday, 'commits today'], [g.commitsWeek, 'commits this week']].forEach(function (p) {
      var sp = el('span');
      sp.appendChild(el('b', '', String(p[0] || 0)));
      sp.appendChild(document.createTextNode(' ' + p[1]));
      nums.appendChild(sp);
    });
    box.appendChild(nums);
    if (g.working && g.working.length) {
      box.appendChild(el('h4', '', 'Working on right now'));
      var ul = el('ul');
      g.working.forEach(function (w) {
        var li = el('li'), d = el('div', '', w.title);
        if (w.total > 0) { d.appendChild(stageBar(w)); }
        li.appendChild(d);
        li.appendChild(el('small', '', w.total > 0 ? w.done + ' of ' + w.total : (w.now ? 'now' : '')));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    if (g.lastDone && g.lastDone.length) {
      box.appendChild(el('h4', '', 'Finished lately'));
      var ul2 = el('ul');
      g.lastDone.forEach(function (w) {
        var li = el('li');
        li.appendChild(el('div', '', w.title));
        li.appendChild(el('small', '', w.date || ''));
        ul2.appendChild(li);
      });
      box.appendChild(ul2);
    }
    var anchor = card.querySelector('ul.ms');
    if (anchor) anchor.parentNode.insertBefore(box, anchor); else card.appendChild(box);
  }

  /* "Last updated <local time> from commit <hash>"; a red warning when the data is older than 3 hours or only the old copy next to the page could be read */
  function freshness(D, fallback) {
    var line = document.getElementById('hub-updated') || document.getElementById('hub-fresh');
    if (!line) {
      var games = document.querySelector('.hubgames');
      if (!games || !games.parentNode) return;
      line = el('p');
      line.id = 'hub-fresh';
      games.parentNode.insertBefore(line, games);
    }
    var t = /T\d\d:\d\d/.test(String(D.built)) ? new Date(D.built) : null;
    var when = t && !isNaN(t) ? t.toLocaleString() : String(D.built || 'unknown');
    var text = 'Last updated ' + when + (D.commit ? ' from commit ' + D.commit : '') + '.';
    var ageH = t && !isNaN(t) ? (Date.now() - t.getTime()) / 3600000 : 0;
    var warn = '';
    if (fallback) warn = 'WARNING: the live data could not be loaded, this is the old copy. ';
    else if (ageH > 3) warn = 'WARNING: the data is ' + Math.floor(ageH) + ' hours old, the update is not running. ';
    line.className = warn ? 'hp-warn' : '';
    line.textContent = warn + text;
  }
  function getJson(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }

  /* the hub data comes from the update server first; the files next to the page are the fallback */
  var HUB = 'https://updates.toclink.com/';
  var FALLBACK = false;   /* data.json came from the old file next to the page */
  function getHub(name) { return getJson(HUB + name).catch(function () { if (name === 'data.json') FALLBACK = true; return getJson('./' + name); }); }

  /* milestones.json lists the big steps toward each game's next release; the cards show only those */
  Promise.all([getHub('data.json'), getHub('milestones.json').catch(function () { return null; })]).then(function (r) {
    var D = r[0], M = r[1];
    function pick(game) {
      if (!M || !M[game]) return D.items;
      var ids = {}; M[game].ids.forEach(function (x) { ids[x] = 1; });
      return D.items.filter(function (i) { return i.game === game && ids[i.id]; });
    }
    var cards = document.querySelectorAll('.hubgames .game');
    var d1 = cardFor(cards, 'd1', 0), d2 = cardFor(cards, 'd2', 1);
    if (d1) { setCounts(d1, tally(pick('d1'), 'd1'), true); setRows(d1, pick('d1'), 'd1'); }
    if (d2) { setCounts(d2, tally(pick('d2'), 'd2'), true); setRows(d2, pick('d2'), 'd2'); }
    var go = function () { balance([d1, d2]); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    freshness(D, FALLBACK);
    if (D.games) { if (d1) panel(d1, D.games.d1); if (d2) panel(d2, D.games.d2); }
  }).catch(function () { /* keep the exported numbers */ });

  getHub('changelog.json').then(function (C) {
    var dl = document.querySelector('dl.rel'), box = document.getElementById('hub-changelog');
    if (dl) renderReleases(dl, C);
    if (box) renderChangelog(box, C);
  }).catch(function () { /* keep the exported text */ });
})();
