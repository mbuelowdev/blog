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

function makeSingleFileCliBody(fullPath, filename, linkHref, prompt, escapeHtml) {
  if (!fs.existsSync(fullPath)) {
    return `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">${prompt}</span>ls -al ${escapeHtml(filename)}
ls: cannot access '${escapeHtml(filename)}': No such file or directory
<span class="home-terminal-prompt">${prompt}</span><span class="home-terminal-cursor"></span></pre>
</div>`;
  }
  const rawContent = fs.readFileSync(fullPath, "utf8");
  const stat = fs.statSync(fullPath);
  const lsLine = `-rw-r--r--  1 mbuelow mbuelow ${String(stat.size).padStart(5)} ${formatLsDate(stat.mtime)} <a href="${escapeHtml(linkHref)}" class="home-terminal-file-link">${escapeHtml(filename)}</a>`;
  const escapedContent = escapeHtml(rawContent);
  return `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">${prompt}</span>ls -al ${escapeHtml(filename)}
${lsLine}
<span class="home-terminal-prompt">${prompt}</span>cat ${escapeHtml(filename)}
${escapedContent}
<span class="home-terminal-prompt">${prompt}</span><span class="home-terminal-cursor"></span></pre>
</div>`;
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
  const homeDirs = [
    { name: ".", href: null },
    { name: "..", href: null },
    { name: "blog", href: "blog/index.html" },
    { name: "contact", href: "contact/index.html" },
    { name: "ctf-challenges", href: "ctf-challenges/index.html" },
    { name: "cheat-sheets", href: "cheat-sheets/index.html" },
    { name: "downloads", href: "downloads/index.html" },
    { name: "projects", href: "projects/index.html" },
    { name: "reversing", href: "reversing/index.html" },
  ];
  const homeLsLinesStr = homeDirs
    .map((d) => {
      const date = d.name === "." ? "Mar 12 14:23" : d.name === ".." ? "Jan  8 09:41" : d.name === "blog" ? "Nov  3 18:07" : d.name === "contact" ? "Sep 21 11:52" : d.name === "ctf-challenges" ? "Jul 15 16:30" : d.name === "cheat-sheets" ? "Feb 28 08:14" : d.name === "downloads" ? "Oct  5 22:19" : d.name === "projects" ? "May 17 13:00" : "Apr  2 10:33";
      const namePart = d.href ? `<a href="${escapeHtml(d.href)}" class="home-terminal-file-link">${escapeHtml(d.name)}</a>` : d.name;
      return `drwxr-xr-x  2 mbuelow mbuelow  4096 ${date} ${namePart}`;
    })
    .join("\n");
  const homeTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-banner">Linux mbuelow-dev 6.1.0-1-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.0-1 (2023-01-07) x86_64

Last login: Fri Jul  7 07:00:07 2023 from 192.168.6.66</pre>
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~$ </span>
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>pwd
/home/mbuelow
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>ls -al
total ${Math.max(8, homeDirs.length)}
${homeLsLinesStr}
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
  const blogLsEntries = [];
  for (const file of blogPosts) {
    const fullPath = path.join(blogDir, file);
    const stat = fs.statSync(fullPath);
    const raw = fs.readFileSync(fullPath, "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const slug = path.basename(file, ".md");
    posts.push({
      slug,
      title: meta.title || slug,
      date: meta.date || "",
      excerpt: meta.excerpt || body.slice(0, 160).replace(/\n/g, " ") + "...",
    });
    blogLsEntries.push({
      name: file,
      size: stat.size,
      mtime: stat.mtime,
    });
  }
  blogLsEntries.sort((a, b) => a.name.localeCompare(b.name));
  for (const p of posts) {
    const fullPath = path.join(blogDir, `${p.slug}.md`);
    const cliBody = makeSingleFileCliBody(
      fullPath,
      `${p.slug}.md`,
      `${p.slug}.html`,
      "mbuelow@dev:~/blog$ ",
      escapeHtml
    );
    writePage(
      `blog/${p.slug}.html`,
      p.title,
      cliBody,
      { activeBlog: true },
      "main--home-terminal"
    );
  }
  posts.sort((a, b) => (b.date > a.date ? 1 : -1));

  // Blog index: CLI style (pwd -> /home/mbuelow/blog, ls -al with real sizes)
  const blogLsLines = [
    "drwxr-xr-x  2 mbuelow mbuelow  4096 Mar 12 14:23 .",
    "drwxr-xr-x  3 mbuelow mbuelow  4096 Jan  8 09:41 ..",
    ...blogLsEntries.map((e) => {
      const slug = path.basename(e.name, ".md");
      const href = escapeHtml(slug + ".html");
      const name = escapeHtml(e.name);
      return `-rw-r--r--  1 mbuelow mbuelow ${String(e.size).padStart(5)} ${formatLsDate(e.mtime)} <a href="${href}" class="home-terminal-file-link">${name}</a>`;
    }),
  ];
  const blogTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~/blog$ </span>pwd
/home/mbuelow/blog
<span class="home-terminal-prompt">mbuelow@dev:~/blog$ </span>ls -al
total ${blogLsEntries.length}
${blogLsLines.join("\n")}
<span class="home-terminal-prompt">mbuelow@dev:~/blog$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  writePage("blog/index.html", "Blog", blogTerminalBody, { activeBlog: true }, "main--home-terminal");

  // Projects index + individual project pages
  const projectsDir = path.join(CONTENT, "projects");
  const projectFiles = fs.existsSync(projectsDir)
    ? fs.readdirSync(projectsDir).filter((f) => f.endsWith(".md"))
    : [];
  const projectList = [];
  const projectLsEntries = [];
  for (const file of projectFiles) {
    const fullPath = path.join(projectsDir, file);
    const stat = fs.statSync(fullPath);
    const raw = fs.readFileSync(fullPath, "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const slug = path.basename(file, ".md");
    projectList.push({
      slug,
      title: meta.title || slug,
      description: meta.description || body.slice(0, 200).replace(/\n/g, " ").trim() + (body.length > 200 ? "…" : ""),
    });
    projectLsEntries.push({
      name: file,
      slug,
      size: stat.size,
      mtime: stat.mtime,
    });
  }
  projectLsEntries.sort((a, b) => a.name.localeCompare(b.name));
  for (const p of projectList) {
    const fullPath = path.join(projectsDir, `${p.slug}.md`);
    const cliBody = makeSingleFileCliBody(
      fullPath,
      `${p.slug}.md`,
      `${p.slug}.html`,
      "mbuelow@dev:~/projects$ ",
      escapeHtml
    );
    writePage(
      `projects/${p.slug}.html`,
      p.title,
      cliBody,
      { activeProjects: true },
      "main--home-terminal"
    );
  }

  // Projects index: CLI style (pwd -> /home/mbuelow/projects, ls -al with real sizes)
  const projectLsLines = [
    "drwxr-xr-x  2 mbuelow mbuelow  4096 Mar 12 14:23 .",
    "drwxr-xr-x  3 mbuelow mbuelow  4096 Jan  8 09:41 ..",
    ...projectLsEntries.map((e) => {
      const href = escapeHtml(e.slug + ".html");
      const name = escapeHtml(e.name);
      return `-rw-r--r--  1 mbuelow mbuelow ${String(e.size).padStart(5)} ${formatLsDate(e.mtime)} <a href="${href}" class="home-terminal-file-link">${name}</a>`;
    }),
  ];
  const projectsTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~/projects$ </span>pwd
/home/mbuelow/projects
<span class="home-terminal-prompt">mbuelow@dev:~/projects$ </span>ls -al
total ${projectLsEntries.length}
${projectLsLines.join("\n")}
<span class="home-terminal-prompt">mbuelow@dev:~/projects$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  writePage("projects/index.html", "Projects", projectsTerminalBody, {
    activeProjects: true,
  }, "main--home-terminal");

  // Cheat sheets index + pages (output under cheat-sheets/)
  const csPath = OUTPUT_PATH.cheatsheets;
  ensureDir(path.join(DIST, csPath));
  const csDir = path.join(CONTENT, "cheatsheets");
  const csFiles = fs.existsSync(csDir)
    ? fs.readdirSync(csDir).filter((f) => f.endsWith(".md"))
    : [];
  const csLsEntries = [];
  for (const file of csFiles) {
    const fullPath = path.join(csDir, file);
    const stat = fs.statSync(fullPath);
    csLsEntries.push({
      name: file,
      slug: path.basename(file, ".md"),
      size: stat.size,
      mtime: stat.mtime,
    });
  }
  csLsEntries.sort((a, b) => a.name.localeCompare(b.name));

  const csLsLines = [
    "drwxr-xr-x  2 mbuelow mbuelow  4096 Mar 12 14:23 .",
    "drwxr-xr-x  3 mbuelow mbuelow  4096 Jan  8 09:41 ..",
    ...csLsEntries.map((e) => {
      const href = escapeHtml(e.slug + ".html");
      const name = escapeHtml(e.name);
      return `-rw-r--r--  1 mbuelow mbuelow ${String(e.size).padStart(5)} ${formatLsDate(e.mtime)} <a href="${href}" class="home-terminal-file-link">${name}</a>`;
    }),
  ];
  const csTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~/cheat-sheets$ </span>pwd
/home/mbuelow/cheat-sheets
<span class="home-terminal-prompt">mbuelow@dev:~/cheat-sheets$ </span>ls -al
total ${csLsEntries.length}
${csLsLines.join("\n")}
<span class="home-terminal-prompt">mbuelow@dev:~/cheat-sheets$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  writePage(`${csPath}/index.html`, "Cheat Sheets", csTerminalBody, {
    activeCheatsheets: true,
  }, "main--home-terminal");

  for (const e of csLsEntries) {
    const fullPath = path.join(csDir, e.name);
    const title = (() => {
      const { meta } = parseFrontMatter(fs.readFileSync(fullPath, "utf8"));
      return meta.title || e.slug;
    })();
    const cliBody = makeSingleFileCliBody(
      fullPath,
      e.name,
      `${e.slug}.html`,
      "mbuelow@dev:~/cheat-sheets$ ",
      escapeHtml
    );
    writePage(`${csPath}/${e.slug}.html`, title, cliBody, {
      activeCheatsheets: true,
    }, "main--home-terminal");
  }

  // CTF index + writeups (output under ctf-challenges/) — CLI style
  const ctfPath = OUTPUT_PATH.ctf;
  const ctfDir = path.join(CONTENT, "ctf");
  const ctfFiles = fs.existsSync(ctfDir)
    ? fs.readdirSync(ctfDir).filter((f) => f.endsWith(".md"))
    : [];
  const ctfLsEntries = [];
  for (const file of ctfFiles) {
    const fullPath = path.join(ctfDir, file);
    const stat = fs.statSync(fullPath);
    ctfLsEntries.push({
      name: file,
      slug: path.basename(file, ".md"),
      size: stat.size,
      mtime: stat.mtime,
    });
  }
  ctfLsEntries.sort((a, b) => a.name.localeCompare(b.name));
  const ctfLsLines = [
    "drwxr-xr-x  2 mbuelow mbuelow  4096 Mar 12 14:23 .",
    "drwxr-xr-x  3 mbuelow mbuelow  4096 Jan  8 09:41 ..",
    ...ctfLsEntries.map((e) => {
      const href = escapeHtml(e.slug + ".html");
      const name = escapeHtml(e.name);
      return `-rw-r--r--  1 mbuelow mbuelow ${String(e.size).padStart(5)} ${formatLsDate(e.mtime)} <a href="${href}" class="home-terminal-file-link">${name}</a>`;
    }),
  ];
  const ctfTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~/ctf-challenges$ </span>pwd
/home/mbuelow/ctf-challenges
<span class="home-terminal-prompt">mbuelow@dev:~/ctf-challenges$ </span>ls -al
total ${ctfLsEntries.length}
${ctfLsLines.join("\n")}
<span class="home-terminal-prompt">mbuelow@dev:~/ctf-challenges$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  ensureDir(path.join(DIST, ctfPath));
  writePage(`${ctfPath}/index.html`, "CTF Writeups", ctfTerminalBody, { activeCtf: true }, "main--home-terminal");

  for (const e of ctfLsEntries) {
    const fullPath = path.join(ctfDir, e.name);
    const title = (() => {
      const { meta } = parseFrontMatter(fs.readFileSync(fullPath, "utf8"));
      return meta.title || e.slug;
    })();
    const cliBody = makeSingleFileCliBody(
      fullPath,
      e.name,
      `${e.slug}.html`,
      "mbuelow@dev:~/ctf-challenges$ ",
      escapeHtml
    );
    writePage(`${ctfPath}/${e.slug}.html`, title, cliBody, {
      activeCtf: true,
    }, "main--home-terminal");
  }

  // Reversing: CLI style (ls -al reversing.md, then cat reversing.md with raw markdown)
  const rePath = OUTPUT_PATH["re-tips"];
  const reTipsPath = path.join(CONTENT, "reversing.md");
  let reversingTerminalBody = "";
  if (fs.existsSync(reTipsPath)) {
    const rawContent = fs.readFileSync(reTipsPath, "utf8");
    const stat = fs.statSync(reTipsPath);
    const lsLine = `-rw-r--r--  1 mbuelow mbuelow ${String(stat.size).padStart(5)} ${formatLsDate(stat.mtime)} <a href="index.html" class="home-terminal-file-link">reversing.md</a>`;
    const escapedContent = escapeHtml(rawContent);
    reversingTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~$ </span>ls -al reversing.md
${lsLine}
<span class="home-terminal-prompt">mbuelow@dev:~$ </span>cat reversing.md
${escapedContent}
<span class="home-terminal-prompt">mbuelow@dev:~$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  } else {
    reversingTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~$ </span>ls -al reversing.md
ls: cannot access 'reversing.md': No such file or directory
<span class="home-terminal-prompt">mbuelow@dev:~$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  }
  writePage(`${rePath}/index.html`, "Reversing", reversingTerminalBody, {
    activeReTips: true,
  }, "main--home-terminal");

  // Downloads: CLI style (pwd -> /home/mbuelow/downloads, ls -al with real sizes)
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
  const downloadLsLines = [
    "drwxr-xr-x  2 mbuelow mbuelow  4096 Mar 12 14:23 .",
    "drwxr-xr-x  3 mbuelow mbuelow  4096 Jan  8 09:41 ..",
    ...downloadLsEntries.map((e) => {
      const href = escapeHtml("files/" + e.name);
      const name = escapeHtml(e.name);
      return `-rw-r--r--  1 mbuelow mbuelow ${String(e.size).padStart(5)} ${formatLsDate(e.mtime)} <a href="${href}" class="home-terminal-file-link">${name}</a>`;
    }),
  ];
  const downloadsTerminalBody = `<div class="home-terminal">
<pre class="home-terminal-session"><span class="home-terminal-prompt">mbuelow@dev:~/downloads$ </span>pwd
/home/mbuelow/downloads
<span class="home-terminal-prompt">mbuelow@dev:~/downloads$ </span>ls -al
total ${downloadLsEntries.length}
${downloadLsLines.join("\n")}
<span class="home-terminal-prompt">mbuelow@dev:~/downloads$ </span><span class="home-terminal-cursor"></span></pre>
</div>`;
  writePage("downloads/index.html", "Downloads", downloadsTerminalBody, {
    activeDownloads: true,
  }, "main--home-terminal");

  // Contact: CLI style (pwd, ls -al with symlinks to GitHub and LinkedIn)
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
  writePage("contact/index.html", "Contact", contactTerminalBody, {
    activeContact: true,
  }, "main--home-terminal");

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
