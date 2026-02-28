import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const TEMPLATES = path.join(ROOT, "templates");
const ASSETS = path.join(ROOT, "assets");
const DIST = path.join(ROOT, "dist");

const PROMPT_ROOT = "mbuelow@dev:~$ ";
const PWD_ROOT = "/home/mbuelow";
const DEFAULT_LS_DATE = "Mar 12 14:23";
const DEFAULT_LS_DATE_PARENT = "Jan  8 09:41";
const MAIN_CLASS_TERMINAL = "main--home-terminal";

let globalVersion = "0.0.0";
const LAST_REFRESHED = new Date().toISOString().replace("T", " ").slice(0, 19);

/** Escape HTML special characters. Returns safe string for use in HTML. */
function escapeHtml(s) {
    if (!s) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Create directory (and parents) if it does not exist. */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
}

/** Format a Date for ls -al (e.g. "Mar 12 14:23"). Returns string. */
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

/** Standard . and .. directory entries for ls -al. Returns array of entry objects. */
function dotEntries(pwdDate = DEFAULT_LS_DATE, parentDate = DEFAULT_LS_DATE_PARENT) {
    return [
        {name: ".", dir: true, dateStr: pwdDate},
        {name: "..", dir: true, dateStr: parentDate},
    ];
}

/** Prompt and pwd for a section (by outputPath). Returns { prompt, pwd }. */
function sectionPromptAndPwd(outputPath) {
    const prompt = outputPath ? `mbuelow@dev:~/${outputPath}$ ` : PROMPT_ROOT;
    const pwd = outputPath ? `${PWD_ROOT}/${outputPath}` : PWD_ROOT;
    return {prompt, pwd};
}

/** Build CLI-style pwd + ls -al block. Entries: { name, size?, mtime?, href?, dir? }. Returns HTML string. */
function renderDirectoryListing(prompt, pwd, entries) {
    const lsLines = entries.map((e) => {
        const perm = e.dir ? "drwxr-xr-x" : "-rw-r--r--";
        const size = e.dir ? "4096" : String(e.size ?? 0).padStart(5);
        const date = e.mtime ? formatLsDate(e.mtime) : (e.dateStr ?? DEFAULT_LS_DATE);
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

/** Fill layout template with opts (title, base, body, nav, breadcrumb, etc.). Returns full HTML string. */
function renderLayout(opts) {
    let html = fs.readFileSync(path.join(TEMPLATES, "layout.html"), "utf8");
    const placeholders = [
        ["title", opts.title || "mbuelow.dev"],
        ["base", opts.base ?? ""],
        ["lastRefreshed", opts.lastRefreshed ?? LAST_REFRESHED],
        ["version", opts.version ?? ""],
        ["mainClass", opts.mainClass ?? ""],
    ];

    for (const [key, value] of placeholders) {
        html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    let body = opts.body ?? "";
    body = body.replace(/\b(src|href)="images\//g, (_, attr) => `${attr}="${opts.base ?? ""}images/`);
    html = html.replace(/\{\{\{body\}\}\}/g, body);
    html = html.replace(/\{\{\{breadcrumb\}\}\}/g, opts.breadcrumb ?? "");
    html = html.replace(/\{\{\{nav\}\}\}/g, opts.nav ?? "");
    html = html.replace(/\{\{\{catWhitelist\}\}\}/g, JSON.stringify(opts.catWhitelist ?? []));
    return html;
}

/** Relative path prefix for links from a given outputPath (e.g. "" for index, "../" for blog/). Returns string. */
function getBase(outputPath) {
    const segments = outputPath.split("/").filter(Boolean);
    if (segments.length <= 1) return "";
    return "../".repeat(segments.length - 1);
}

/** Load sections from content/sections.json, sorted by order. Returns array of section objects. */
function loadSections() {
    const p = path.join(CONTENT, "sections.json");
    if (!fs.existsSync(p)) throw new Error("content/sections.json not found");
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    const sections = (data.sections || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return sections;
}

/** Create all output directories used by the build. */
function createOutputDirs(sections) {
    ensureDir(DIST);
    ensureDir(path.join(DIST, "downloads"));
    ensureDir(path.join(DIST, "downloads", "files"));
    ensureDir(path.join(DIST, "contact"));

    // Generate folders for the static assets
    for (const assetFolder of ["css", "js", "fonts", "images"]) {
        if (fs.existsSync(path.join(ASSETS, assetFolder))) ensureDir(path.join(DIST, assetFolder));
    }

    // Generate folders for the sections
    for (const s of sections) {
        if (s.outputPath) ensureDir(path.join(DIST, s.outputPath));
    }
}

/** Build sidebar nav HTML from sections, with activeSectionId and base for hrefs. Returns HTML string. */
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

/** Breadcrumb items for a page (root vs section index). Returns array of { pathSlug, href }. */
function getBreadcrumb(outputPath) {
    const segments = outputPath.split("/").filter(Boolean);
    if (segments.length === 0) return [];
    if (segments.length === 1 && segments[0] === "index.html")
        return [{pathSlug: "~", href: ""}];

    const sectionSlug = segments[0];
    if (segments[1] === "index.html")
        return [{pathSlug: sectionSlug, href: ""}];
    return [
        {pathSlug: sectionSlug, href: "index.html"},
        {pathSlug: "page", href: ""},
    ];
}

/** Build breadcrumb nav HTML from outputPath. Returns HTML string or "". */
function renderBreadcrumbHtml(outputPath) {
    const items = getBreadcrumb(outputPath);
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

/** Write one full HTML page to dist (layout + body, nav, breadcrumb, catWhitelist). */
function writePage(sections, outputPath, title, bodyHtml, activeSectionId, mainClass = "", catWhitelist = []) {
    const outFile = path.join(DIST, outputPath);
    const base = getBase(outputPath);
    const breadcrumbHtml = renderBreadcrumbHtml(outputPath);
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
        catWhitelist,
    });
    fs.writeFileSync(outFile, html, "utf8");
}

/** Build home page: Debian banner + ls of section dirs from config. */
function buildHome(sections, catWhitelist) {
    const homeSectionDirs = sections.filter((s) => s.id !== "home").map((s) => ({
        name: s.outputPath || s.id,
        href: s.outputPath === "" ? "index.html" : `${s.outputPath}/index.html`,
    }));
    const homeEntries = [
        ...dotEntries(),
        ...homeSectionDirs.map((d) => ({name: d.name, dir: true, size: 4096, dateStr: DEFAULT_LS_DATE, href: d.href})),
    ];
    const homeLsLinesStr = homeEntries.map((e) => {
        const date = e.dateStr ?? DEFAULT_LS_DATE;
        const namePart = e.href != null ? `<a href="${escapeHtml(e.href)}" class="home-terminal-file-link">${escapeHtml(e.name)}</a>` : escapeHtml(e.name);
        return `drwxr-xr-x  2 mbuelow mbuelow  4096 ${date} ${namePart}`;
    }).join("\n");

    const homeTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-banner">Linux mbuelow-dev 6.1.0-1-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.0-1 (2023-01-07) x86_64

Last login: Fri Jul  7 07:00:07 2023 from 192.168.6.66</pre>
<pre class="home-terminal-session"><span class="home-terminal-prompt">${PROMPT_ROOT}</span>
<span class="home-terminal-prompt">${PROMPT_ROOT}</span>
<span class="home-terminal-prompt">${PROMPT_ROOT}</span>pwd
${PWD_ROOT}
<span class="home-terminal-prompt">${PROMPT_ROOT}</span>ls -al
total ${Math.max(8, homeEntries.length)}
${homeLsLinesStr}
<span class="home-terminal-prompt">${PROMPT_ROOT}</span><span class="home-terminal-cursor"></span></pre>
</div>`;
    writePage(sections, "index.html", "Home", homeTerminalBody, "home", MAIN_CLASS_TERMINAL, catWhitelist);
}

/** Build downloads page: pwd + ls with direct links to files; copy files to dist/downloads/files. */
function buildDownloads(sections, catWhitelist) {
    const downloadsFilesSrc = path.join(CONTENT, "downloads");
    const downloadsFilesDest = path.join(DIST, "downloads", "files");
    const downloadLsEntries = [];

    if (fs.existsSync(downloadsFilesSrc)) {
        for (const name of fs.readdirSync(downloadsFilesSrc)) {
            const src = path.join(downloadsFilesSrc, name);
            if (fs.statSync(src).isFile()) {
                const stat = fs.statSync(src);
                downloadLsEntries.push({name, size: stat.size, mtime: stat.mtime});
                fs.copyFileSync(src, path.join(downloadsFilesDest, name));
            }
        }
    }

    downloadLsEntries.sort((a, b) => a.name.localeCompare(b.name));
    const downloadEntries = [
        ...dotEntries(),
        ...downloadLsEntries.map((e) => ({name: e.name, size: e.size, mtime: e.mtime, href: `files/${e.name}`})),
    ];
    const {prompt: downloadsPrompt, pwd: downloadsPwd} = sectionPromptAndPwd("downloads");
    const downloadsTerminalBody = renderDirectoryListing(downloadsPrompt, downloadsPwd, downloadEntries);
    writePage(sections, "downloads/index.html", "Downloads", downloadsTerminalBody, "downloads", MAIN_CLASS_TERMINAL, catWhitelist);
}

/** Build contact page: pwd + ls with symlinks (e.g. GitHub, LinkedIn). */
function buildContact(sections, catWhitelist) {
    const {prompt: contactPrompt, pwd: contactPwd} = sectionPromptAndPwd("contact");
    const contactTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">${contactPrompt}</span>pwd
${contactPwd}
<span class="home-terminal-prompt">${contactPrompt}</span>ls -al
total 4
drwxr-xr-x  2 mbuelow mbuelow  4096 Mar 12 14:23 .
drwxr-xr-x  3 mbuelow mbuelow  4096 Jan  8 09:41 ..
lrwxrwxrwx  1 mbuelow mbuelow  28 Feb 28 12:00 github -> <a href="https://github.com/mbuelowdev" class="home-terminal-file-link" rel="noopener noreferrer">https://github.com/mbuelowdev</a>
lrwxrwxrwx  1 mbuelow mbuelow  35 Feb 28 12:00 linkedin -> <a href="https://linkedin.com/in/mbuelowdev" class="home-terminal-file-link" rel="noopener noreferrer">https://linkedin.com/in/mbuelowdev</a>
<span class="home-terminal-prompt">${contactPrompt}</span><span class="home-terminal-cursor"></span></pre>
</div>`;

    writePage(sections, "contact/index.html", "Contact", contactTerminalBody, "contact", MAIN_CLASS_TERMINAL, catWhitelist);
}

/** Main build: clear dist, copy assets, generate all section pages and home/downloads/contact. */
function build() {
    // Recreate dist folder if it already exists; clean slate
    if (fs.existsSync(DIST)) {
        fs.rmSync(DIST, {recursive: true});
    }

    // Fetch version from deployment.json
    const deploymentPath = path.join(ROOT, "deployment.json");
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    globalVersion = deployment.version;

    // Load config
    const sections = loadSections();

    // Create the output dirs in dist/
    createOutputDirs(sections);

    // Create the whitelist for the dynamic markdown files
    const catWhitelist = [];
    for (const s of sections) {
        if (!s.contentDir) continue;
        const dir = path.join(CONTENT, s.contentDir);
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) if (name.endsWith(".md")) catWhitelist.push(name);
    }

    // Copy assets
    for (const sub of ["css", "js", "fonts", "images"]) {
        const src = path.join(ASSETS, sub);
        const dest = path.join(DIST, sub);
        if (fs.existsSync(src)) {
            for (const name of fs.readdirSync(src)) {
                fs.copyFileSync(path.join(src, name), path.join(dest, name));
            }
        }
    }

    // Build the static pages
    buildHome(sections, catWhitelist);
    buildDownloads(sections, catWhitelist);
    buildContact(sections, catWhitelist);

    // Build the dynamic pages
    // Sections with contentDir and .md files: one index.html + copy .md to dist
    for (const section of sections) {
        if (section.id === "home" || section.id === "contact" || section.id === "downloads") continue;
        const contentDir = section.contentDir ? path.join(CONTENT, section.contentDir) : null;
        if (!contentDir || !fs.existsSync(contentDir)) continue;
        const mdFiles = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));
        const {prompt, pwd} = sectionPromptAndPwd(section.outputPath);
        const entries = [
            ...dotEntries(),
            ...mdFiles.map((name) => {
                const fullPath = path.join(contentDir, name);
                const stat = fs.statSync(fullPath);
                return {name, size: stat.size, mtime: stat.mtime, href: `?cat=${encodeURIComponent(name)}`};
            }),
        ];
        const body = renderDirectoryListing(prompt, pwd, entries);
        writePage(sections, `${section.outputPath}/index.html`, section.label, body, section.id, MAIN_CLASS_TERMINAL, catWhitelist);
        for (const name of mdFiles) {
            fs.copyFileSync(path.join(contentDir, name), path.join(DIST, section.outputPath, name));
        }
    }

    console.log("Build done. Output in dist/");
}


build();
