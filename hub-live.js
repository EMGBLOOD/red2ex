/* hub-live.js - fills the Project hub from data.json and changelog.json (both written by refresh_site.ps1).
   Place the three files next to the exported pages. All text goes in with textContent, never innerHTML.
   Cards: .game with data-game="d1" / "d2" (else first = Driver 1, second = Driver 2).
   Releases list: <dl class="rel">.  Changelog: <div id="hub-changelog">.
   If a file cannot be read the page keeps what it was exported with. */
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
    }
    var bar = card.querySelector('.bar');
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
  function row(it) {
    var st = it.status === 'done' ? 'ok' : ((it.status === 'planned' || it.status === 'hold') ? '' : 'act');
    var li = el('li', st ? 's-' + st : '');
    li.appendChild(el('span', 'dot'));
    var d = el('div', '', it.title);
    var note = it.text || '';
    if (it.total > 0 && it.status !== 'done') note += (note ? ' ' : '') + it.done + ' of ' + it.total + ' stages done.';
    if (note) d.appendChild(el('small', '', note));
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
    list.slice(0, MAX_ROWS).forEach(function (i) { ul.appendChild(row(i)); });
    if (rest.length) {
      var li = el('li', 'more'), det = el('details'), sum = el('summary', '', 'Show ' + rest.length + ' more'), inner = el('ul', 'ms');
      det.addEventListener('toggle', function () { sum.textContent = det.open ? 'Show fewer' : 'Show ' + rest.length + ' more'; });
      rest.forEach(function (i) { inner.appendChild(row(i)); });
      det.appendChild(sum); det.appendChild(inner); li.appendChild(det); ul.appendChild(li);
    }
  }
  function cardFor(cards, game, idx) {
    for (var k = 0; k < cards.length; k++) if (cards[k].getAttribute('data-game') === game) return cards[k];
    return cards[idx] || null;
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
  function getJson(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }

  getJson('./data.json').then(function (D) {
    var cards = document.querySelectorAll('.hubgames .game');
    var d1 = cardFor(cards, 'd1', 0), d2 = cardFor(cards, 'd2', 1);
    if (d1) { setCounts(d1, tally(D.items, 'd1'), true); setRows(d1, D.items, 'd1'); }
    if (d2) { setCounts(d2, tally(D.items, 'd2'), false); setRows(d2, D.items, 'd2'); }
    var up = document.getElementById('hub-updated');
    if (up) up.textContent = 'Last updated ' + D.built + '.';
  }).catch(function () { /* keep the exported numbers */ });

  getJson('./changelog.json').then(function (C) {
    var dl = document.querySelector('dl.rel'), box = document.getElementById('hub-changelog');
    if (dl) renderReleases(dl, C);
    if (box) renderChangelog(box, C);
  }).catch(function () { /* keep the exported text */ });
})();
