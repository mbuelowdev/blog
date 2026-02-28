import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const TEMPLATES = path.join(ROOT, "templates");
const ASSETS = path.join(ROOT, "assets");
const DIST = path.join(ROOT, "dist");

let globalVersion = "";

const LAST_REFRESHED = new Date().toISOString().replace("T", " ").slice(0, 19);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      meta[key] = value;
    }
  }
  return { meta, body: match[2] };
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
  const active = opts.active ?? {};
  for (const key of [
    "activeHome",
    "activeBlog",
    "activeProjects",
    "activeCheatsheets",
    "activeCtf",
    "activeReTips",
    "activeDownloads",
    "activeContact",
  ]) {
    const regex = new RegExp(
      `\\{\\{#${key}\\}\\} active\\{\\{/${key}\\}\\}`,
      "g"
    );
    html = html.replace(regex, active[key] ? " active" : "");
  }
  return html;
}

function getBase(outputPath) {
  const segments = outputPath.split("/").filter(Boolean);
  if (segments.length <= 1) return "";
  return "../".repeat(segments.length - 1);
}

const SECTION_LABELS = {
  blog: "Blog",
  projects: "Projects",
  cheatsheets: "Cheat Sheets",
  ctf: "CTF-Challenges",
  "re-tips": "Reversing",
  downloads: "Downloads",
  contact: "Contact",
};

/* URL path segment (lowercase, dashed) for each section. Output dirs and links use these. */
const OUTPUT_PATH = {
  blog: "blog",
  projects: "projects",
  cheatsheets: "cheat-sheets",
  ctf: "ctf-challenges",
  "re-tips": "reversing",
  downloads: "downloads",
  contact: "contact",
};

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function getBreadcrumb(outputPath, title) {
  const segments = outputPath.split("/").filter(Boolean);
  if (segments.length === 0) return [];
  if (segments.length === 1 && segments[0] === "index.html") return [];

  const sectionSlug = segments[0];
  const isIndexPage = segments[1] === "index.html";

  /* Section index: one path segment (e.g. /cheat-sheets), no link to home. */
  if (isIndexPage)
    return [{ pathSlug: sectionSlug, href: "" }];

  /* Subpage: section (link to index) + current page slug. */
  const titleSlug = slugify(title);
  return [
    { pathSlug: sectionSlug, href: "index.html" },
    { pathSlug: titleSlug || "page", href: "" },
  ];
}

function renderBreadcrumbHtml(outputPath, title) {
  const items = getBreadcrumb(outputPath, title);
  if (items.length === 0) return "";
  const prompt = 'mbuelow@dev:';
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

function writePage(outputPath, title, bodyHtml, active = {}, mainClass = "") {
  const outFile = path.join(DIST, outputPath);
  ensureDir(path.dirname(outFile));
  const base = getBase(outputPath);
  const breadcrumbHtml = renderBreadcrumbHtml(outputPath, title);
  const html = renderLayout({
    title,
    base,
    lastRefreshed: LAST_REFRESHED,
    body: bodyHtml,
    active,
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

  // Home (terminal-style: no title/links, Debian banner + fake ls)
  const homeTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-banner">Linux mbuelow-dev 6.1.0-1-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.0-1 (2023-01-07) x86_64

Last login: Fri Jul  7 07:00:07 2023 from 192.168.6.66</pre>
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~$ </span>
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>pwd
/home/mbuelow
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>ls -al
total 8
drwxr-xr-x  2 mbuelow mbuelow  4096 Mar 12 14:23 .
drwxr-xr-x  3 mbuelow mbuelow  4096 Jan  8 09:41 ..
drwxr-xr-x  2 mbuelow mbuelow  4096 Nov  3 18:07 blog
drwxr-xr-x  2 mbuelow mbuelow  4096 Sep 21 11:52 contact
drwxr-xr-x  2 mbuelow mbuelow  4096 Jul 15 16:30 ctf-challenges
drwxr-xr-x  2 mbuelow mbuelow  4096 Feb 28 08:14 cheat-sheets
drwxr-xr-x  2 mbuelow mbuelow  4096 Oct  5 22:19 downloads
drwxr-xr-x  2 mbuelow mbuelow  4096 May 17 13:00 projects
drwxr-xr-x  2 mbuelow mbuelow  4096 Apr  2 10:33 reversing
<span class="home-terminal-prompt">mbuelow@dev:~$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  writePage(
    "index.html",
    "Home",
    homeTerminalBody,
    { activeHome: true },
    "main--home-terminal"
  );

  // Blog index + posts
  const blogDir = path.join(CONTENT, "blog");
  const blogPosts = fs.existsSync(blogDir)
    ? fs.readdirSync(blogDir).filter((f) => f.endsWith(".md"))
    : [];
  const posts = [];
  for (const file of blogPosts) {
    const raw = fs.readFileSync(path.join(blogDir, file), "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const slug = path.basename(file, ".md");
    posts.push({
      slug,
      title: meta.title || slug,
      date: meta.date || "",
      excerpt: meta.excerpt || body.slice(0, 160).replace(/\n/g, " ") + "...",
    });
    writePage(
      `blog/${slug}.html`,
      meta.title || slug,
      marked.parse(body),
      { activeBlog: true }
    );
  }
  posts.sort((a, b) => (b.date > a.date ? 1 : -1));
  let blogIndexBody = "<ul class=\"post-list\">";
  for (const p of posts) {
    blogIndexBody += `<li><a href="${getBase("blog/index.html")}blog/${p.slug}.html">${escapeHtml(p.title)}</a>${p.date ? ` <span class=\"date\">${escapeHtml(p.date)}</span>` : ""}</li>`;
  }
  blogIndexBody += "</ul>";
  writePage("blog/index.html", "Blog", blogIndexBody, { activeBlog: true });

  // Projects index + individual project pages
  const projectsDir = path.join(CONTENT, "projects");
  const projectFiles = fs.existsSync(projectsDir)
    ? fs.readdirSync(projectsDir).filter((f) => f.endsWith(".md"))
    : [];
  const projectList = [];
  for (const file of projectFiles) {
    const raw = fs.readFileSync(path.join(projectsDir, file), "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const slug = path.basename(file, ".md");
    projectList.push({
      slug,
      title: meta.title || slug,
      description: meta.description || body.slice(0, 200).replace(/\n/g, " ").trim() + (body.length > 200 ? "…" : ""),
      thumbnail: meta.thumbnail || "images/project-placeholder.png",
    });
    writePage(
      `projects/${slug}.html`,
      meta.title || slug,
      marked.parse(body),
      { activeProjects: true }
    );
  }
  let projectsIndexBody = "";
  if (projectList.length === 0) {
    projectsIndexBody = "<p>No projects yet.</p>";
  } else {
    projectsIndexBody = '<p class="projects-intro">A list of projects I\'ve done in the past or still working on right now.</p><ul class="project-list">';
    for (const p of projectList) {
      const thumbHtml = `<span class="project-item-thumb"><img src="${escapeHtml(p.thumbnail)}" alt="" loading="lazy"></span>`;
      projectsIndexBody += `<li class="project-item"><a href="${p.slug}.html" class="project-item-link">${thumbHtml}<span class="project-item-content"><span class="project-item-title">${escapeHtml(p.title)}</span>${p.description ? `<p class="project-item-desc">${escapeHtml(p.description)}</p>` : ""}</span></a></li>`;
    }
    projectsIndexBody += "</ul>";
  }
  writePage("projects/index.html", "Projects", projectsIndexBody, {
    activeProjects: true,
  });

  // Cheat sheets index + x86, binary-ninja (output under cheat-sheets/)
  const csPath = OUTPUT_PATH.cheatsheets;
  ensureDir(path.join(DIST, csPath));
  const csIndexBody = `
    <ul>
      <li><a href="x86.html">x86 Instruction Set Lookup</a></li>
      <li><a href="binary-ninja.html">Binary Ninja Disassembly Symbols</a></li>
    </ul>`;
  writePage(`${csPath}/index.html`, "Cheat Sheets", csIndexBody, {
    activeCheatsheets: true,
  });

  const x86Path = path.join(CONTENT, "cheatsheets", "x86.md");
  if (fs.existsSync(x86Path)) {
    const { body } = parseFrontMatter(fs.readFileSync(x86Path, "utf8"));
    writePage(`${csPath}/x86.html`, "x86 Instruction Set", marked.parse(body), {
      activeCheatsheets: true,
    });
  }

  const bnPath = path.join(CONTENT, "cheatsheets", "binary-ninja.md");
  if (fs.existsSync(bnPath)) {
    const { body } = parseFrontMatter(fs.readFileSync(bnPath, "utf8"));
    writePage(
      `${csPath}/binary-ninja.html`,
      "Binary Ninja Symbols",
      marked.parse(body),
      { activeCheatsheets: true }
    );
  }

  // CTF index + writeups (output under ctf-challenges/)
  const ctfPath = OUTPUT_PATH.ctf;
  const ctfDir = path.join(CONTENT, "ctf");
  const ctfFiles = fs.existsSync(ctfDir)
    ? fs.readdirSync(ctfDir).filter((f) => f.endsWith(".md"))
    : [];
  let ctfIndexBody = "<ul>";
  for (const file of ctfFiles) {
    const raw = fs.readFileSync(path.join(ctfDir, file), "utf8");
    const { meta } = parseFrontMatter(raw);
    const slug = path.basename(file, ".md");
    ctfIndexBody += `<li><a href="${slug}.html">${escapeHtml(meta.title || slug)}</a></li>`;
  }
  ctfIndexBody += "</ul>";
  writePage(`${ctfPath}/index.html`, "CTF Writeups", ctfIndexBody, { activeCtf: true });

  for (const file of ctfFiles) {
    const raw = fs.readFileSync(path.join(ctfDir, file), "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const slug = path.basename(file, ".md");
    writePage(`${ctfPath}/${slug}.html`, meta.title || slug, marked.parse(body), {
      activeCtf: true,
    });
  }

  // RE Tips (output under reversing/)
  const rePath = OUTPUT_PATH["re-tips"];
  const reTipsPath = path.join(CONTENT, "reversing.md");
  const reTipsBody = fs.existsSync(reTipsPath)
    ? marked.parse(
        parseFrontMatter(fs.readFileSync(reTipsPath, "utf8")).body
      )
    : "<p>Tips coming soon.</p>";
  writePage(`${rePath}/index.html`, "Reversing", reTipsBody, {
    activeReTips: true,
  });

  // Downloads: from content/downloads.json
  const downloadsPath = path.join(CONTENT, "downloads.json");
  let downloadsBody = "<p>No downloads yet.</p>";
  if (fs.existsSync(downloadsPath)) {
    const list = JSON.parse(fs.readFileSync(downloadsPath, "utf8"));
    const files = Array.isArray(list) ? list : list.files || [];
    downloadsBody = `<table><thead><tr><th>Name</th><th>Description</th><th>Size</th><th></th></tr></thead><tbody>`;
    for (const f of files) {
      const size = f.size != null ? f.size : "—";
      const url = (f.path || f.url || "#").startsWith("http") ? f.path || f.url : "files/" + (f.path || f.url || "");
      downloadsBody += `<tr><td>${escapeHtml(f.name)}</td><td>${escapeHtml(f.description || "")}</td><td>${escapeHtml(size)}</td><td><a href="${escapeHtml(url)}" download>Download</a></td></tr>`;
    }
    downloadsBody += "</tbody></table>";
  }
  ensureDir(path.join(DIST, "downloads"));
  writePage("downloads/index.html", "Downloads", downloadsBody, {
    activeDownloads: true,
  });
  const downloadsFilesSrc = path.join(CONTENT, "downloads");
  const downloadsFilesDest = path.join(DIST, "downloads", "files");
  ensureDir(downloadsFilesDest);
  if (fs.existsSync(downloadsFilesSrc)) {
    for (const name of fs.readdirSync(downloadsFilesSrc)) {
      const src = path.join(downloadsFilesSrc, name);
      if (fs.statSync(src).isFile())
        fs.copyFileSync(src, path.join(downloadsFilesDest, name));
    }
  }

  // Contact
  const contactPath = path.join(CONTENT, "contact", "index.md");
  const contactBody = fs.existsSync(contactPath)
    ? marked.parse(
        parseFrontMatter(fs.readFileSync(contactPath, "utf8")).body
      )
    : `<p>Reach out via <a href="https://github.com/mbuelowdev">GitHub</a>. LinkedIn coming soon.</p>`;
  ensureDir(path.join(DIST, "contact"));
  writePage("contact/index.html", "Contact", contactBody, {
    activeContact: true,
  });

  console.log("Build done. Output in dist/");
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

build();
