/* site.js - the project status page. No library, no build step. All text from data.js / data.json is put in with textContent, never innerHTML.
 * Network: none, except (when site.ini names a repository) ONE read of the public issue list of GitHub, cached 10 minutes in localStorage. */
(function () {
  "use strict";
  var D = window.SITE_DATA || null;
  var STATE_LABEL = { o: "Open", p: "In progress", d: "Done", c: "Needs a test" };
  var STATE_CLASS = { o: "s-open", p: "s-progress", d: "s-done", c: "s-confirm" };
  var MARK = { x: "[x]", "~": "[~]", " ": "[ ]", "?": "[?]" };
  var CACHE_MS = 10 * 60 * 1000;
  var issues = [];

  function h(tag, attrs) {
    var el = document.createElement(tag), i, k, c;
    for (k in (attrs || {})) { if (k === "text") el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); }
    for (i = 2; i < arguments.length; i++) {
      c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }
  function $(id) { return document.getElementById(id); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function store(op, key, val) {
    try { return op === "get" ? window.localStorage.getItem(key) : window.localStorage.setItem(key, val); } catch (e) { return null; }
  }

  /* ---------- theme ---------- */
  function applyTheme(mode) {
    var root = document.documentElement;
    if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode); else root.removeAttribute("data-theme");
    $("theme").textContent = "Theme: " + (mode === "light" || mode === "dark" ? mode : "auto");
  }
  function initTheme() {
    var mode = store("get", "site-theme") || "auto";
    applyTheme(mode);
    $("theme").addEventListener("click", function () {
      mode = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
      store("set", "site-theme", mode);
      applyTheme(mode);
    });
  }

  /* ---------- tabs ---------- */
  var tabs = [];
  function addTab(id, label, enabled) { if (enabled !== false) tabs.push({ id: id, label: label }); }
  function showTab(id, focus) {
    var i, on;
    for (i = 0; i < tabs.length; i++) {
      on = tabs[i].id === id;
      $("sec-" + tabs[i].id).hidden = !on;
      $("tab-" + tabs[i].id).setAttribute("aria-selected", on ? "true" : "false");
      $("tab-" + tabs[i].id).tabIndex = on ? 0 : -1;
    }
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* file:// in some browsers */ }
    if (focus) $("tab-" + id).focus();
  }
  function buildTabs() {
    var bar = $("tabs"), i, t;
    function mk(t) {
      var b = h("button", { type: "button", role: "tab", id: "tab-" + t.id, "aria-controls": "sec-" + t.id, "aria-selected": "false", "class": "tab", text: t.label });
      b.addEventListener("click", function () { showTab(t.id); });
      b.addEventListener("keydown", function (e) {
        var k = e.key, n = tabs.indexOf(t);
        if (k === "ArrowRight") n = (n + 1) % tabs.length; else if (k === "ArrowLeft") n = (n + tabs.length - 1) % tabs.length; else return;
        e.preventDefault(); showTab(tabs[n].id, true);
      });
      return b;
    }
    for (i = 0; i < tabs.length; i++) { t = tabs[i]; bar.appendChild(mk(t)); }
    document.addEventListener("click", function (e) {
      var g = e.target && e.target.getAttribute ? e.target.getAttribute("data-goto") : null;
      if (g) { e.preventDefault(); showTab(g, true); }
    });
  }

  /* ---------- overview ---------- */
  function card(cls, n, label) { return h("div", { "class": "card " + cls }, h("b", { text: String(n) }), h("span", { text: label })); }
  function renderOverview() {
    var c = D.counts, cards = $("cards");
    cards.appendChild(card("c-progress", c.progress, "in progress"));
    cards.appendChild(card("c-open", c.open, "open"));
    if (c.confirm) cards.appendChild(card("c-confirm", c.confirm, "waiting for a test"));
    cards.appendChild(card("c-done", c.done, "done"));
    var jobs = $("jobs"), i, j, pct, ul;
    if (!D.jobs.length) jobs.appendChild(h("p", { "class": "empty", text: "No big jobs are listed." }));
    for (i = 0; i < D.jobs.length; i++) {
      j = D.jobs[i];
      pct = j.total ? Math.round(100 * j.done / j.total) : 0;
      ul = h("ul", { "class": "stages" });
      j.stages.forEach(function (s) { ul.appendChild(h("li", null, h("span", { "class": "mk", text: MARK[s.m] || "[ ]" }), h("span", null, s.c + "  " + s.t))); });
      jobs.appendChild(h("div", { "class": "job" },
        h("div", { "class": "job-head" }, h("span", { "class": "job-title", text: j.title }), h("span", { "class": "chip", text: STATE_LABEL[j.state] + (j.total ? ", " + j.done + " of " + j.total + " stages" : "") })),
        j.total ? h("div", { "class": "bar", role: "img", "aria-label": pct + " percent of the stages done" }, h("i", { "class": "b-done", style: "width:" + (100 * j.done / j.total) + "%" }), h("i", { "class": "b-part", style: "width:" + (100 * j.partly / j.total) + "%" })) : null,
        j.text ? h("p", { text: j.text }) : null,
        j.total ? h("details", null, h("summary", { text: "Stages" }), ul) : null));
    }
    $("updated").textContent = "Last updated " + D.built + ". " + (D.internal ? "Internal build: every item is shown." : "Only items marked public are listed here.");
  }

  /* ---------- roadmap lists ---------- */
  function issuesFor(id) {
    var out = [], re = new RegExp("\\[" + id.replace(/[^\w-]/g, "") + "\\]", "i");
    issues.forEach(function (is) {
      var hit = re.test(is.title) || (is.labels || []).some(function (l) { return String(l.name || l).toLowerCase() === "item:" + id.toLowerCase(); });
      if (hit) out.push(is);
    });
    return out;
  }
  function itemNode(it) {
    var head = h("h4", null, it.id ? h("span", { "class": "id", text: it.id }) : null, h("span", { text: it.title }), h("span", { "class": "chip", text: STATE_LABEL[it.state] }));
    var li = h("li", { "class": "item " + STATE_CLASS[it.state] }, head);
    if (it.text) li.appendChild(h("p", { text: it.text }));
    if (it.added) li.appendChild(h("p", { "class": "meta", text: "Added: " + it.added }));
    if (it.date) li.appendChild(h("p", { "class": "meta", text: (it.state === "d" ? "Done: " : "Date: ") + it.date }));
    if (it.detail) li.appendChild(h("p", { "class": "meta", text: "Detail: " + it.detail }));
    if (it.evidence) li.appendChild(h("p", { "class": "meta", text: "Evidence: " + it.evidence }));
    var is = issuesFor(it.id);
    if (is.length) {
      var ul = h("ul", { "class": "issue-links" });
      is.forEach(function (x) { ul.appendChild(h("li", null, h("a", { href: x.html_url, rel: "noopener" }, "Issue #" + x.number + ": " + x.title))); });
      li.appendChild(ul);
    }
    return li;
  }
  function renderList(listId, pick, withFilters) {
    var ul = $(listId), box = ul.previousElementSibling, q, sel, order, all = D.items.filter(pick);
    /* newest first by the day the item was added (done items by the day they were done when that is known), the original order breaks ties */
    function key(it) { return String((listId === "list-done" && it.date) ? it.date : (it.added || it.date || "")); }
    all.forEach(function (it, n) { it._n = n; });
    function sortAll(oldFirst) {
      all.sort(function (a, b) { var k = key(b).localeCompare(key(a)); if (oldFirst) k = -k; return k || (a._n - b._n); });
    }
    sortAll(false);
    function draw() {
      var text = (q ? q.value : "").toLowerCase(), shown = 0;
      clear(ul);
      all.forEach(function (it) {
        if (text && (it.id + " " + it.title + " " + (it.text || "")).toLowerCase().indexOf(text) < 0) return;
        if (sel && sel.value !== "all" && it.state !== sel.value) return;
        ul.appendChild(itemNode(it)); shown++;
      });
      if (!shown) ul.appendChild(h("li", { "class": "empty", text: all.length ? "Nothing matches the filter." : "Nothing here yet." }));
    }
    if (withFilters && box && all.length) {
      q = h("input", { type: "search", placeholder: "Search " + all.length + " entries", "aria-label": "Search" });
      q.addEventListener("input", draw);
      box.appendChild(q);
      order = h("select", { "aria-label": "Sort by date" }, h("option", { value: "new", text: "Newest first" }), h("option", { value: "old", text: "Oldest first" }));
      order.addEventListener("change", function () { sortAll(order.value === "old"); draw(); });
      box.appendChild(order);
      if (listId === "list-open") {
        sel = h("select", { "aria-label": "Filter by state" }, h("option", { value: "all", text: "All" }), h("option", { value: "o", text: "Open" }), h("option", { value: "c", text: "Needs a test" }));
        sel.addEventListener("change", draw);
        box.appendChild(sel);
      }
    }
    draw();
    return draw;
  }

  /* ---------- changelog ---------- */
  function renderChangelog() {
    var root = $("changelog");
    if (!D.changelog.length) { root.appendChild(h("p", { "class": "empty", text: "No changelog." })); return; }
    D.changelog.forEach(function (r, n) {
      var body = h("div", { "class": "body" });
      r.intro.forEach(function (p) { body.appendChild(h("p", { text: p })); });
      r.sections.forEach(function (s) {
        var ul = h("ul");
        body.appendChild(h("h4", { text: s.title }));
        s.lines.forEach(function (l) { ul.appendChild(h("li", { text: l })); });
        body.appendChild(ul);
      });
      var d = h("details", { "class": "release" }, h("summary", { text: r.title }), body);
      if (n === 0) d.setAttribute("open", "");
      root.appendChild(d);
    });
  }

  /* ---------- GitHub: issues panel and report button ---------- */
  function repoUrl(g, path) { return "https://github.com/" + encodeURIComponent(g.owner) + "/" + encodeURIComponent(g.repo) + path; }
  function reportUrl(g, template, title, labels) {
    return repoUrl(g, "/issues/new?template=" + encodeURIComponent(template) + "&title=" + encodeURIComponent(title) + "&labels=" + encodeURIComponent(labels));
  }
  function setupReport() {
    var g = D.github, btn = $("report-btn"), feat = $("feature-btn"), note = $("report-note");
    if (!g.enabled) {
      btn.addEventListener("click", function (e) { e.preventDefault(); note.textContent = "The issue tracker opens with the public release. Until then, follow the steps above and keep your log files."; });
      return;
    }
    btn.setAttribute("href", reportUrl(g, g.template, "[bug] ", g.labels || "bug"));
    btn.setAttribute("rel", "noopener");
    feat.hidden = false;
    feat.setAttribute("href", reportUrl(g, g.featureTemplate, "[feature] ", "enhancement"));
    feat.setAttribute("rel", "noopener");
  }
  function drawIssues(list) {
    var ul = $("list-issues"), st = $("issues-status");
    issues = list.filter(function (x) { return !x.pull_request; });
    clear(ul);
    st.textContent = issues.length ? "" : "No open issues.";
    issues.forEach(function (x) {
      var labels = h("span");
      (x.labels || []).forEach(function (l) { labels.appendChild(h("span", { "class": "label", text: String(l.name || l) })); });
      ul.appendChild(h("li", { "class": "item s-open" },
        h("h4", null, h("a", { href: x.html_url, rel: "noopener" }, "#" + x.number + "  " + x.title)),
        h("p", { "class": "meta" }, labels, " opened " + String(x.created_at || "").slice(0, 10))));
    });
    ["list-open", "list-progress", "list-done"].forEach(function (id) { if (D.redraw[id]) D.redraw[id](); });
  }
  function loadIssues() {
    var g = D.github, st = $("issues-status"), key = "site-issues-" + g.owner + "/" + g.repo, now = Date.now(), raw, c, q = location.search.match(/[?&]issues=([\w.-]+\.js)(?:&|$)/);
    if (q) {   /* debug: a same-folder .js file that sets window.SITE_FAKE_ISSUES (works from file://; the repository need not exist) */
      var s = document.createElement("script");
      s.src = q[1];
      s.onload = function () { drawIssues(window.SITE_FAKE_ISSUES || []); st.textContent = "Test data from " + q[1] + "."; };
      s.onerror = function () { st.textContent = "Could not read the test file " + q[1] + "."; };
      document.head.appendChild(s);
      return;
    }
    raw = store("get", key);
    try { c = raw ? JSON.parse(raw) : null; } catch (e) { c = null; }
    if (c && now - c.t < CACHE_MS && Array.isArray(c.v)) { drawIssues(c.v); st.textContent = st.textContent || ""; return; }
    st.textContent = "Loading issues ...";
    fetch("https://api.github.com/repos/" + encodeURIComponent(g.owner) + "/" + encodeURIComponent(g.repo) + "/issues?state=open&per_page=50", { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) {
        if (r.status === 403 || r.status === 429) throw new Error("GitHub allows only 60 reads per hour from one address and that limit is used up. Try again later, or open the tracker on GitHub.");
        if (r.status === 404) throw new Error("The issue tracker was not found.");
        if (!r.ok) throw new Error("GitHub answered with status " + r.status + ".");
        return r.json();
      })
      .then(function (list) {
        if (!Array.isArray(list)) throw new Error("Unexpected answer from GitHub.");
        store("set", key, JSON.stringify({ t: Date.now(), v: list }));
        drawIssues(list);
      })
      .catch(function (e) {
        st.textContent = (e && e.message && e.message.indexOf("Failed") < 0 ? e.message : "The issue list could not be loaded (you may be offline).") + " ";
        st.appendChild(h("a", { href: repoUrl(g, "/issues"), rel: "noopener" }, "Open the tracker on GitHub"));
      });
  }

  /* ---------- start ---------- */
  function start() {
    initTheme();
    if (!D) {
      $("main").insertBefore(h("p", { "class": "note", text: "The data file data.js is missing or broken, so nothing can be shown." }), $("main").firstChild);
      return;
    }
    D.redraw = {};
    D.jobs = D.items.filter(function (i) { return i.total > 0; }).sort(function (a, b) { return String(b.added || "").localeCompare(String(a.added || "")); });
    $("version").textContent = D.version;
    $("foot-text").textContent = "Built " + D.built + " from the project to-do lists. " + (D.github.enabled ? "Issues: github.com/" + D.github.owner + "/" + D.github.repo + "." : "The issue tracker opens with the public release.");
    if (D.internal) { var b = $("banner"); b.hidden = false; b.textContent = "INTERNAL BUILD - do not host this folder, it shows private items."; }
    addTab("overview", "Overview");
    addTab("progress", "In progress");
    addTab("open", "Open");
    addTab("done", "Done");
    addTab("changelog", "Changelog");
    addTab("known", "Known issues");
    addTab("issues", "Open issues", D.github.enabled);
    addTab("report", "Report a bug");
    buildTabs();
    renderOverview();
    D.redraw["list-progress"] = renderList("list-progress", function (i) { return i.state === "p"; }, true);
    D.redraw["list-open"] = renderList("list-open", function (i) { return i.state === "o" || i.state === "c"; }, true);
    D.redraw["list-done"] = renderList("list-done", function (i) { return i.state === "d"; }, true);
    D.redraw["list-known"] = renderList("list-known", function (i) { return i.bug && (i.state === "o" || i.state === "p"); }, false);
    renderChangelog();
    setupReport();
    var want = (location.hash || "#overview").slice(1);
    showTab(tabs.some(function (t) { return t.id === want; }) ? want : "overview");
    if (D.github.enabled) loadIssues();
  }
  start();
}());
