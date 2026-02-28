# AGENTS.md

## Cursor Cloud specific instructions

This is a static site generator (personal portfolio/blog for mbuelow.dev). It converts Markdown content into a styled HTML website using a single Node.js build script.

### Architecture

- **Single service**: No backend, no database, no APIs
- **Build**: `npm run build` runs `node scripts/build.mjs`, which reads `content/` Markdown files, applies `templates/layout.html`, copies `assets/`, and outputs to `dist/`
- **Serve**: Any static HTTP server can serve `dist/` (e.g., `npx serve dist -l 8080`)
- **Docker**: `docker compose up` builds and serves via nginx on port 8080 (optional for local dev)

### Development commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Build site | `npm run build` |
| Serve locally | `npx serve dist -l 8080` |

### Notes

- There are no automated tests, no linter, and no TypeScript in this project. The only runtime dependency is `marked` (Markdown parser).
- The `dist/` directory is gitignored; always run `npm run build` before serving.
- The build script uses ESM (`"type": "module"` in `package.json`), requiring Node.js 20+.
- **Images in content**: Use HTML `<img>` in Markdown, not `![alt](url)`, so size can be controlled (e.g. `width="400"` or `style="max-width: 50%;"`). Use `src="images/filename.png"`; the build rewrites it per-page. Put image files in `assets/images/`.
