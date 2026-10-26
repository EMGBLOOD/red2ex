/* site.js - the project status page. No library, no build step. All text from data.js / data.json is put in with textContent, never innerHTML.
 * Network: none, except (when site.ini names a repository) ONE read of the public issue list of GitHub, cached 10 minutes in localStorage. */
(function () {
  "use strict";
  var D = window.SITE_DATA || null;
  /* the five groups, in the order a visitor wants them: what is being built, what waits for a check, what is next, what is parked, what is finished */
  var GROUPS = [
    { id: "now", tab: "Working on now", title: "Working on right now", short: "being built today", help: "Somebody is working on these today.", cls: "st-now" },
    { id: "testing", tab: "Needs a check", title: "Built, waiting for a check", short: "built, waits for a hands-on check", help: "These are built. They still need a hands-on try-out (with a pad, with the ears, by eye) before they count as done.", cls: "st-testing" },
    { id: "planned", tab: "Planned", title: "Planned, not started", short: "not started yet", help: "Ideas and jobs that are wanted but nobody has started.", cls: "st-planned" },
    { id: "hold", tab: "On hold", title: "Started, but on hold", short: "started, nobody works on it right now", help: "Work that was started and then parked. Some of it is waiting for something else, some was stopped on purpose; the text says which.", cls: "st-hold" },
    { id: "done", tab: "Done", title: "Done", short: "finished and in the game", help: "Finished work. The changelog has the same news in order of version.", cls: "st-done" }
  ];
  var AREAS = [
    ["cars", "Cars"], ["driving", "Driving and gameplay"], ["graphics", "Graphics"], ["sound", "Sound and music"], ["menus", "Menus, controls and camera"],
    ["multiplayer", "Multiplayer"], ["editor", "Editor and missions"], ["cities", "Cities and levels"], ["install", "Install, files and languages"], ["behind", "Behind the scenes"]
  ];
  var MARK = { x: ["✓", "m-x"], "~": ["◐", "m-t"], " ": ["○", "m-o"], "?": ["?", "m-q"] };
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
  function groupOf(id) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i]; return GROUPS[0]; }
  function areaName(id) { for (var i = 0; i < AREAS.length; i++) if (AREAS[i][0] === id) return AREAS[i][1]; return id; }

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
  /* top tabs: Overview, Changelog, ...; the five status groups are sub tabs inside the Overview page (the summary is the first sub tab) */
  var tabs = [], subs = [];
  function addTab(id, label, count, enabled) { if (enabled !== false) tabs.push({ id: id, label: label, count: count }); }
  function isSub(id) { for (var i = 0; i < subs.length; i++) if (subs[i].id === id) return true; return false; }
  function showTab(id, focus) {
    var i, on, sub = null, top = id;
    if (id === "overview") sub = "summary";
    else if (isSub(id)) { top = "overview"; sub = id; }
    for (i = 0; i < tabs.length; i++) {
      on = tabs[i].id === top;
      $("sec-" + tabs[i].id).hidden = !on;
      $("tab-" + tabs[i].id).setAttribute("aria-selected", on ? "true" : "false");
      $("tab-" + tabs[i].id).tabIndex = on ? 0 : -1;
    }
    if (sub) {
      $("ov-summary").hidden = sub !== "summary";
      for (i = 0; i < subs.length; i++) {
        on = subs[i].id === sub;
        if (subs[i].id !== "summary") $("sec-" + subs[i].id).hidden = !on;
        $("sub-" + subs[i].id).setAttribute("aria-selected", on ? "true" : "false");
        $("sub-" + subs[i].id).tabIndex = on ? 0 : -1;
      }
    }
    menuLabels(top, sub);
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* file:// in some browsers */ }
    if (focus) $((sub ? "sub-" + sub : "tab-" + top)).focus();
  }
  /* narrow screens: both tab rows fold into a button that shows where you are and opens the list on a tap (the rows themselves are plain lists on wide screens) */
  function labelOf(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].label + (list[i].count != null ? " (" + list[i].count + ")" : ""); return ""; }
  function menuLabels(top, sub) {
    $("menu-btn").textContent = "☰  " + labelOf(tabs, top) + "  ▾";
    if (sub) $("sub-btn").textContent = "Showing: " + labelOf(subs, sub) + "  ▾";
    ["tabs", "subtabs"].forEach(function (b) { $(b).classList.remove("open"); });
    ["menu-btn", "sub-btn"].forEach(function (b) { $(b).setAttribute("aria-expanded", "false"); });
  }
  function wireMenu(btnId, barId) {
    $(btnId).addEventListener("click", function () {
      var open = !$(barId).classList.contains("open");
      $(barId).classList.toggle("open", open);
      $(btnId).setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  function buildBar(bar, list, prefix, pick) {
    list.forEach(function (t) {
      var b = h("button", { type: "button", role: "tab", id: prefix + t.id, "aria-selected": "false", "class": "tab" }, t.label, t.count != null ? h("span", { "class": "n", text: " " + t.count }) : null);
      b.addEventListener("click", function () { showTab(t.id); });
      b.addEventListener("keydown", function (e) {
        var k = e.key, n = list.indexOf(t);
        if (k === "ArrowRight") n = (n + 1) % list.length; else if (k === "ArrowLeft") n = (n + list.length - 1) % list.length; else return;
        e.preventDefault(); showTab(list[n].id, true);
      });
      bar.appendChild(b);
    });
  }
  function buildTabs() {
    buildBar($("tabs"), tabs, "tab-");
    buildBar($("subtabs"), subs, "sub-");
    wireMenu("menu-btn", "tabs");
    wireMenu("sub-btn", "subtabs");
    document.addEventListener("click", function (e) {
      var el = e.target, g = null;
      while (el && el.getAttribute && !(g = el.getAttribute("data-goto"))) el = el.parentNode;
      if (g) { e.preventDefault(); showTab(g, true); }
    });
  }

  /* ---------- pieces ---------- */
  function bar(it) {
    var pct = it.total ? Math.round(100 * it.done / it.total) : 0;
    return h("div", { "class": "bar", role: "img", "aria-label": pct + " percent of the steps done" },
      h("i", { "class": "b-done", style: "width:" + (100 * it.done / it.total) + "%" }), h("i", { "class": "b-part", style: "width:" + (100 * it.partly / it.total) + "%" }));
  }
  function stageList(it) {
    var ul = h("ul", { "class": "stages" });
    it.stages.forEach(function (s) {
      var m = MARK[s.m] || MARK[" "];
      ul.appendChild(h("li", null, h("span", { "class": "mk " + m[1], text: m[0], title: s.m === "x" ? "done" : s.m === "~" ? "started" : s.m === "?" ? "built, needs a check" : "not started" }), h("span", { text: s.t })));
    });
    return ul;
  }
  function stepsText(it) { return it.done + " of " + it.total + " steps done" + (it.partly ? ", " + it.partly + " started" : ""); }
  function issuesFor(id) {
    var out = [], re = new RegExp("\\[" + id.replace(/[^\w-]/g, "") + "\\]", "i");
    issues.forEach(function (is) {
      var hit = re.test(is.title) || (is.labels || []).some(function (l) { return String(l.name || l).toLowerCase() === "item:" + id.toLowerCase(); });
      if (hit) out.push(is);
    });
    return out;
  }
  function itemNode(it, withArea) {
    var g = groupOf(it.status);
    var head = h("h4", null, h("span", { text: it.title }), it.bug ? h("span", { "class": "label tag-bug", text: "known problem" }) : null, withArea ? h("span", { "class": "label", text: areaName(it.area) }) : null);
    var li = h("li", { "class": "item s-" + it.status }, head);
    if (it.text) li.appendChild(h("p", { text: it.text }));
    if (it.total) {
      li.appendChild(bar(it));
      li.appendChild(h("details", null, h("summary", { text: stepsText(it) }), stageList(it)));
    }
    var when = it.status === "done" ? (it.date ? "Done " + it.date : "") : (it.added ? "Added " + it.added : "");
    li.appendChild(h("p", { "class": "meta", text: (when ? when + " · " : "") + g.short + (it.bug ? " · " + it.id : "") }));
    var is = issuesFor(it.id);
    if (is.length) {
      var ul = h("ul", { "class": "issue-links" });
      is.forEach(function (x) { ul.appendChild(h("li", null, h("a", { href: x.html_url, rel: "noopener" }, "Report #" + x.number + ": " + x.title))); });
      li.appendChild(ul);
    }
    return li;
  }
  function jobNode(it) {
    return h("div", { "class": "job" },
      h("div", { "class": "job-head" }, h("span", { "class": "job-title", text: it.title }), h("span", { "class": "chip plain", text: areaName(it.area) + (it.total ? " · " + stepsText(it) : "") })),
      it.total ? bar(it) : null,
      it.text ? h("p", { text: it.text }) : null,
      it.total ? h("details", { open: "" }, h("summary", { text: "Steps" }), stageList(it)) : null);
  }
  function dayKey(it) { return String(it.status === "done" && it.date ? it.date : (it.added || it.date || "")); }

  /* ---------- overview ---------- */
  function renderOverview() {
    var cards = $("cards"), now = $("now-jobs"), recent = $("recent");
    GROUPS.forEach(function (g) {
      var b = h("button", { type: "button", "class": "card " + g.cls, "data-goto": g.id }, h("b", { text: String(D.counts[g.id]) }), h("strong", { text: g.tab }), h("span", { text: g.short }));
      cards.appendChild(b);
    });
    var list = D.items.filter(function (i) { return i.status === "now"; });
    if (!list.length) now.appendChild(h("p", { "class": "empty", text: "Nothing is being worked on at this moment." }));
    list.forEach(function (it) { now.appendChild(jobNode(it)); });
    D.items.filter(function (i) { return i.status === "done"; }).sort(function (a, b) { return dayKey(b).localeCompare(dayKey(a)); }).slice(0, 8)
      .forEach(function (it) { recent.appendChild(itemNode(it, true)); });
    $("updated").textContent = "Last updated " + D.built + ". " + D.items.length + " items in total, " + D.counts.bugs + " of them known problems.";
  }

  /* ---------- the five lists ---------- */
  function buildListPanel(g) {
    var sec = h("section", { id: "sec-" + g.id, "class": "panel inner", role: "tabpanel", "aria-labelledby": "sub-" + g.id, hidden: "" });
    var filters = h("div", { "class": "filters" }), body = h("div");
    var all = D.items.filter(function (i) { return i.status === g.id; }), q, areaSel, order, oldFirst = false;
    sec.appendChild(h("h2", { text: g.title }));
    sec.appendChild(h("p", { "class": "muted", text: g.help }));
    sec.appendChild(filters);
    sec.appendChild(body);
    all.forEach(function (it, n) { it._n = n; });
    function draw() {
      var text = (q ? q.value : "").toLowerCase(), want = areaSel ? areaSel.value : "all", shown = 0;
      clear(body);
      AREAS.forEach(function (a) {
        var list = all.filter(function (it) {
          if (it.area !== a[0] || (want !== "all" && want !== a[0])) return false;
          return !text || (it.id + " " + it.title + " " + (it.text || "")).toLowerCase().indexOf(text) >= 0;
        });
        if (!list.length) return;
        list.sort(function (x, y) { var k = dayKey(y).localeCompare(dayKey(x)); if (oldFirst) k = -k; return k || (x._n - y._n); });
        var ul = h("ul", { "class": "items" }), d = h("details", { "class": "areas" }, h("summary", null, a[1] + " ", h("span", { "class": "n", text: "(" + list.length + ")" })), ul);
        list.forEach(function (it) { ul.appendChild(itemNode(it, false)); });
        if (g.id !== "done" || text || want !== "all" || all.length < 40) d.setAttribute("open", "");
        body.appendChild(d); shown += list.length;
      });
      if (!shown) body.appendChild(h("p", { "class": "empty", text: all.length ? "Nothing matches the filter." : "Nothing here at the moment." }));
    }
    if (all.length > 6) {
      q = h("input", { type: "search", placeholder: "Search " + all.length + " entries", "aria-label": "Search" });
      q.addEventListener("input", draw);
      filters.appendChild(q);
      areaSel = h("select", { "aria-label": "Filter by topic" }, h("option", { value: "all", text: "All topics" }));
      AREAS.forEach(function (a) { areaSel.appendChild(h("option", { value: a[0], text: a[1] })); });
      areaSel.addEventListener("change", draw);
      filters.appendChild(areaSel);
      order = h("select", { "aria-label": "Sort by date" }, h("option", { value: "new", text: "Newest first" }), h("option", { value: "old", text: "Oldest first" }));
      order.addEventListener("change", function () { oldFirst = order.value === "old"; draw(); });
      filters.appendChild(order);
    }
    $("lists").appendChild(sec);
    draw();
    return draw;
  }

  /* ---------- known problems ---------- */
  function renderKnown() {
    var ul = $("list-known"), list = D.items.filter(function (i) { return i.bug && i.status !== "done"; });
    clear(ul);
    list.forEach(function (it) { ul.appendChild(itemNode(it, true)); });
    if (!list.length) ul.appendChild(h("li", { "class": "empty", text: "No known problems are listed." }));
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
        s.lines.forEach(function (l) { ul.appendChild(h("li", { text: l })); });
        if (r.sections.length === 1) body.appendChild(ul);
        else body.appendChild(h("details", { "class": "sect" }, h("summary", null, s.title + " ", h("span", { "class": "n", text: "(" + s.lines.length + ")" })), ul));
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
    st.textContent = issues.length ? "" : "No open reports.";
    issues.forEach(function (x) {
      var labels = h("span");
      (x.labels || []).forEach(function (l) { labels.appendChild(h("span", { "class": "label", text: String(l.name || l) })); });
      ul.appendChild(h("li", { "class": "item s-planned" },
        h("h4", null, h("a", { href: x.html_url, rel: "noopener" }, "#" + x.number + "  " + x.title)),
        h("p", { "class": "meta" }, labels, " opened " + String(x.created_at || "").slice(0, 10))));
    });
    Object.keys(D.redraw).forEach(function (k) { D.redraw[k](); });
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
    st.textContent = "Loading reports ...";
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
        st.textContent = (e && e.message && e.message.indexOf("Failed") < 0 ? e.message : "The report list could not be loaded (you may be offline).") + " ";
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
    $("version").textContent = "Version " + D.version;
    var ft = $("foot-text");
    ft.appendChild(document.createTextNode("Built " + D.built + " from the project to-do lists. "));
    if (D.github.enabled) {
      ft.appendChild(document.createTextNode("Reports: "));
      ft.appendChild(h("a", { href: repoUrl(D.github, ""), rel: "noopener", text: "github.com/" + D.github.owner + "/" + D.github.repo }));
      ft.appendChild(document.createTextNode("."));
    } else ft.appendChild(document.createTextNode("The issue tracker opens with the public release."));
    addTab("overview", "Overview");
    subs.push({ id: "summary", label: "Summary" });
    GROUPS.forEach(function (g) { subs.push({ id: g.id, label: g.tab, count: D.counts[g.id] }); });
    addTab("changelog", "Changelog");
    addTab("known", "Known problems", D.counts.bugs);
    addTab("issues", "Open reports", null, D.github.enabled);
    addTab("report", "Report a bug");
    GROUPS.forEach(function (g) { D.redraw[g.id] = buildListPanel(g); });
    buildTabs();
    renderOverview();
    renderKnown();
    D.redraw.known = renderKnown;
    renderChangelog();
    setupReport();
    var want = (location.hash || "#overview").slice(1);
    showTab(tabs.some(function (t) { return t.id === want; }) || isSub(want) ? want : "overview");
    if (D.github.enabled) loadIssues();
  }
  start();
}());
