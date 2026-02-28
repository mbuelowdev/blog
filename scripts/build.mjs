import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const TEMPLATES = path.join(ROOT, "templates");
const ASSETS = path.join(ROOT, "assets");
const DIST = path.join(ROOT, "dist");

let globalVersion = "";

const LAST_REFRESHED = new Date().toISOString().replace("T", " ").slice(0, 19);

function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatLsDate(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(date);
  const m = months[d.getMonth()];
  const day = d.getDate().toString().padStart(2, " ");
  const h = d.getHours();
  const min = d.getMinutes();
  const time = `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
  return `${m} ${day} ${time}`;
}

/** Entries: { name, size?, mtime?, href?, dir? } — include . and .. for dirs. */
function renderDirectoryListing(prompt, pwd, entries) {
  const lsLines = entries.map((e) => {
    const perm = e.dir ? "drwxr-xr-x" : "-rw-r--r--";
    const size = e.dir ? "4096" : String(e.size ?? 0).padStart(5);
    const date = e.mtime ? formatLsDate(e.mtime) : (e.dateStr ?? "Mar 12 14:23");
    const namePart = e.href != null
      ? `<a href="${escapeHtml(e.href)}" class="home-terminal-file-link">${escapeHtml(e.name)}</a>`
      : escapeHtml(e.name);
    return `${perm}  2 mbuelow mbuelow ${size} ${date} ${namePart}`;
  });
  const total = entries.length;
  return `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">${prompt}</span>pwd
${pwd}
<span class="home-terminal-prompt">${prompt}</span>ls -al
total ${total}
${lsLines.join("\n")}
<span class="home-terminal-prompt">${prompt}</span><span class="home-terminal-cursor"></span></pre>
</div>`;
}

function renderLayout(opts) {
  let html = fs.readFileSync(path.join(TEMPLATES, "layout.html"), "utf8");
  html = html.replace(/\{\{title\}\}/g, opts.title || "mbuelow.dev");
  html = html.replace(/\{\{base\}\}/g, opts.base ?? "");
  html = html.replace(/\{\{lastRefreshed\}\}/g, opts.lastRefreshed ?? LAST_REFRESHED);
  /* Resolve images/ and links to images/ relative to current page (base). */
  let body = opts.body ?? "";
  body = body.replace(/\b(src|href)="images\//g, (_, attr) => `${attr}="${opts.base ?? ""}images/`);
  html = html.replace(/\{\{\{body\}\}\}/g, body);
  html = html.replace(/\{\{\{breadcrumb\}\}\}/g, opts.breadcrumb ?? "");
  html = html.replace(/\{\{version\}\}/g, opts.version ?? "");
  html = html.replace(/\{\{mainClass\}\}/g, opts.mainClass ?? "");
  html = html.replace(/\{\{\{nav\}\}\}/g, opts.nav ?? "");
  return html;
}

function getBase(outputPath) {
  const segments = outputPath.split("/").filter(Boolean);
  if (segments.length <= 1) return "";
  return "../".repeat(segments.length - 1);
}

function loadSections() {
  const p = path.join(CONTENT, "sections.json");
  if (!fs.existsSync(p)) throw new Error("content/sections.json not found");
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  const sections = (data.sections || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sections;
}

function renderNavHtml(sections, activeSectionId, base) {
  const parts = [];
  let lastGroup = null;
  for (const s of sections) {
    if (s.navGroup !== lastGroup) {
      lastGroup = s.navGroup;
      if (lastGroup !== "Main") {
        parts.push(`<div class="nav-section">${escapeHtml(lastGroup)}</div>`);
      }
    }
    const href = s.outputPath === "" ? `${base}index.html` : `${base}${s.outputPath}/index.html`;
    const active = s.id === activeSectionId ? " active" : "";
    parts.push(`<a href="${escapeHtml(href)}" class="nav-link${active}">${escapeHtml(s.label)}</a>`);
  }
  return parts.join("\n      ");
}

function getBreadcrumb(outputPath, title) {
  const segments = outputPath.split("/").filter(Boolean);
  if (segments.length === 0) return [];
  if (segments.length === 1 && segments[0] === "index.html")
    return [{ pathSlug: "~", href: "" }];
  const sectionSlug = segments[0];
  const isIndexPage = segments[1] === "index.html";
  if (isIndexPage)
    return [{ pathSlug: sectionSlug, href: "" }];
  return [
    { pathSlug: sectionSlug, href: "index.html" },
    { pathSlug: "page", href: "" },
  ];
}

function renderBreadcrumbHtml(outputPath, title) {
  const items = getBreadcrumb(outputPath, title);
  if (items.length === 0) return "";
  if (items.length === 1 && items[0].pathSlug === "~") {
    return `<nav class="breadcrumb breadcrumb-cli" aria-label="Breadcrumb"><span class="breadcrumb-prompt">mbuelow@dev:~</span><span class="breadcrumb-prompt">$</span></nav>`;
  }
  const prompt = "mbuelow@dev:~";
  const pathParts = [];
  for (const item of items) {
    if (item.href)
      pathParts.push(
        `<a href="${escapeHtml(item.href)}" class="breadcrumb-link">${escapeHtml(item.pathSlug)}</a>`
      );
    else
      pathParts.push(
        `<span class="breadcrumb-current">${escapeHtml(item.pathSlug)}</span>`
      );
  }
  const pathStr = pathParts.join('<span class="breadcrumb-sep">/</span>');
  return `<nav class="breadcrumb breadcrumb-cli" aria-label="Breadcrumb"><span class="breadcrumb-prompt">${prompt}</span><span class="breadcrumb-sep">/</span>${pathStr}<span class="breadcrumb-prompt">$</span></nav>`;
}

function writePage(sections, outputPath, title, bodyHtml, activeSectionId, mainClass = "") {
  const outFile = path.join(DIST, outputPath);
  ensureDir(path.dirname(outFile));
  const base = getBase(outputPath);
  const breadcrumbHtml = renderBreadcrumbHtml(outputPath, title);
  const nav = renderNavHtml(sections, activeSectionId, base);
  const html = renderLayout({
    title,
    base,
    lastRefreshed: LAST_REFRESHED,
    body: bodyHtml,
    nav,
    breadcrumb: breadcrumbHtml,
    version: globalVersion,
    mainClass,
  });
  fs.writeFileSync(outFile, html, "utf8");
}

function build() {
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  ensureDir(DIST);

  const deploymentPath = path.join(ROOT, "deployment.json");
  globalVersion = "";
  if (fs.existsSync(deploymentPath)) {
    try {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      globalVersion = deployment.version ?? "";
    } catch (_) {}
  }

  // Load config
  const sections = loadSections();

  // Copy assets
  for (const sub of ["css", "js", "fonts", "images"]) {
    const src = path.join(ASSETS, sub);
    const dest = path.join(DIST, sub);
    if (fs.existsSync(src)) {
      ensureDir(dest);
      for (const name of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, name), path.join(dest, name));
      }
    }
  }

  // Home: Debian banner + ls of section dirs (from config, exclude home)
  const homeSectionDirs = sections.filter((s) => s.id !== "home").map((s) => ({
    name: s.outputPath || s.id,
    href: s.outputPath === "" ? "index.html" : `${s.outputPath}/index.html`,
  }));
  const homeEntries = [
    { name: ".", dir: true, dateStr: "Mar 12 14:23" },
    { name: "..", dir: true, dateStr: "Jan  8 09:41" },
    ...homeSectionDirs.map((d) => ({ name: d.name, dir: true, size: 4096, dateStr: "Mar 12 14:23", href: d.href })),
  ];
  const homeLsLinesStr = homeEntries.map((e) => {
    const date = e.dateStr ?? "Mar 12 14:23";
    const namePart = e.href != null ? `<a href="${escapeHtml(e.href)}" class="home-terminal-file-link">${escapeHtml(e.name)}</a>` : escapeHtml(e.name);
    return `drwxr-xr-x  2 mbuelow mbuelow  4096 ${date} ${namePart}`;
  }).join("\n");
  const homeTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-banner">Linux mbuelow-dev 6.1.0-1-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.0-1 (2023-01-07) x86_64

Last login: Fri Jul  7 07:00:07 2023 from 192.168.6.66</pre>
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~$ </span>
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>pwd
/home/mbuelow
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>ls -al
total ${Math.max(8, homeEntries.length)}
${homeLsLinesStr}
<span class="home-terminal-prompt">mbuelow@dev:~$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  writePage(sections, "index.html", "Home", homeTerminalBody, "home", "main--home-terminal");

  // Sections with contentDir and .md files: one index.html + copy .md to dist
  for (const section of sections) {
    if (section.id === "home" || section.id === "contact" || section.id === "downloads") continue;
    const contentDir = section.contentDir ? path.join(CONTENT, section.contentDir) : null;
    if (!contentDir || !fs.existsSync(contentDir)) continue;
    const mdFiles = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));
    const prompt = section.outputPath ? `mbuelow@dev:~/${section.outputPath}$ ` : "mbuelow@dev:~$ ";
    const pwd = section.outputPath ? `/home/mbuelow/${section.outputPath}` : "/home/mbuelow";
    const entries = [
      { name: ".", dir: true, dateStr: "Mar 12 14:23" },
      { name: "..", dir: true, dateStr: "Jan  8 09:41" },
      ...mdFiles.map((name) => {
        const fullPath = path.join(contentDir, name);
        const stat = fs.statSync(fullPath);
        return { name, size: stat.size, mtime: stat.mtime, href: `?cat=${encodeURIComponent(name)}` };
      }),
    ];
    const body = renderDirectoryListing(prompt, pwd, entries);
    ensureDir(path.join(DIST, section.outputPath));
    writePage(sections, `${section.outputPath}/index.html`, section.label, body, section.id, "main--home-terminal");
    for (const name of mdFiles) {
      fs.copyFileSync(path.join(contentDir, name), path.join(DIST, section.outputPath, name));
    }
  }

  // Downloads: pwd + ls with direct links to files (no ?cat=)
  ensureDir(path.join(DIST, "downloads"));
  const downloadsFilesSrc = path.join(CONTENT, "downloads");
  const downloadsFilesDest = path.join(DIST, "downloads", "files");
  ensureDir(downloadsFilesDest);
  const downloadLsEntries = [];
  if (fs.existsSync(downloadsFilesSrc)) {
    for (const name of fs.readdirSync(downloadsFilesSrc)) {
      const src = path.join(downloadsFilesSrc, name);
      if (fs.statSync(src).isFile()) {
        const stat = fs.statSync(src);
        downloadLsEntries.push({ name, size: stat.size, mtime: stat.mtime });
        fs.copyFileSync(src, path.join(downloadsFilesDest, name));
      }
    }
  }
  downloadLsEntries.sort((a, b) => a.name.localeCompare(b.name));
  const downloadEntries = [
    { name: ".", dir: true, dateStr: "Mar 12 14:23" },
    { name: "..", dir: true, dateStr: "Jan  8 09:41" },
    ...downloadLsEntries.map((e) => ({ name: e.name, size: e.size, mtime: e.mtime, href: `files/${e.name}` })),
  ];
  const downloadsTerminalBody = renderDirectoryListing("mbuelow@dev:~/downloads$ ", "/home/mbuelow/downloads", downloadEntries);
  writePage(sections, "downloads/index.html", "Downloads", downloadsTerminalBody, "downloads", "main--home-terminal");

  // Contact: pwd + ls with symlinks
  ensureDir(path.join(DIST, "contact"));
  const contactSymlinks = [
    { name: "github", target: "https://github.com/mbuelowdev", size: 28 },
    { name: "linkedin", target: "https://linkedin.com/in/mbuelowdev", size: 35 },
  ];
  const contactLsLines = [
    "drwxr-xr-x  2 mbuelow mbuelow  4096 Mar 12 14:23 .",
    "drwxr-xr-x  3 mbuelow mbuelow  4096 Jan  8 09:41 ..",
    ...contactSymlinks.map(
      (s) =>
        `lrwxrwxrwx  1 mbuelow mbuelow  ${String(s.size).padStart(2)} Feb 28 12:00 ${escapeHtml(s.name)} -> <a href="${escapeHtml(s.target)}" class="home-terminal-file-link" rel="noopener noreferrer">${escapeHtml(s.target)}</a>`
    ),
  ];
  const contactTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~/contact$ </span>pwd
/home/mbuelow/contact
<span class="home-terminal-prompt">mbuelow@dev:~/contact$ </span>ls -al
total ${contactSymlinks.length}
${contactLsLines.join("\n")}
<span class="home-terminal-prompt">mbuelow@dev:~/contact$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  writePage(sections, "contact/index.html", "Contact", contactTerminalBody, "contact", "main--home-terminal");

  console.log("Build done. Output in dist/");
}

build();
