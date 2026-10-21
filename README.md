# Convergent Chaos

A personal CFD and optimization portfolio for **Yannis G. Kordos**, with a numerical playground. Built with plain HTML, CSS and JavaScript. No framework, build step, CDN, external fonts, analytics or backend.

## Run locally

From this directory, using Ubuntu/WSL:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://localhost:4173. You can also open `index.html` directly in a browser.

## Structure

- `index.html`: introduction, freelance services, interactive playground, selected credentials and contact.
- `styles.css`: responsive design, reduced-motion support and print styles.
- `app.js`: analytic potential-flow hero illustration, section reveals, navigation state and validated iframe resizing.
- `resume.html`, `resume.css`, `resume.js`: concise professional résumé with print/save-as-PDF support.
- `toys/fixed-point.html`, `.css`, `.js`: standalone cosine fixed-point toy; use `?embed=1` for the homepage embed.
- `assets/mark.svg`: local vector identity/favicon.
- `export-check.js`: browser checks for the page, actual numerical convergence, interaction and responsive embedding.
- `portfolio-example.html` and `embed-heights.js`: retained original scaffold; the first now points to the current toy.

## Content and design

**Visual thesis:** an engineer's notebook with warm paper, deep green, lime, editorial typography and a live potential-flow field.

**Content plan:** introduce the practice; explain three services; let visitors play with an actual numerical algorithm; substantiate experience; invite a project conversation.

**Interaction thesis:** a staggered hero entrance, pointer-responsive flow tracers that pause offscreen, restrained section reveals, and a step-by-step numerical cobweb. Motion preferences are respected.

CV content is deliberately selective: CFD, continuous adjoints, fuel cells, aerodynamic surrogates, education and scientific software. Toyota Motor Europe and NTUA appear as doctoral research hosts. No clients, commercial outcomes or performance improvements are invented. The original CV, home address and telephone number are not included in the site. Contact and profile links come from the supplied CV.

The hero uses analytic potential flow around a cylinder, not a CFD solver or a quantitative research result. Future toys are explicitly marked as workbench ideas. The fixed-point toy is implemented and playable.

## Extend the playground

Add a self-contained toy under `toys/` and give its iframe an accessible title. For automatic height updates, send a message from the child to the same origin:

```js
window.parent.postMessage(
  { type: 'convergent-chaos:toy-height', height: measuredContentHeight },
  location.origin
);
```

The homepage currently accepts messages only from its featured iframe, validates the origin (except local `file:` use), and bounds the height. Add an explicit frame mapping when introducing additional embeds.

## Verify

Syntax checks do not need dependencies:

```bash
node --check app.js
node --check resume.js
node --check toys/fixed-point.js
```

The browser check requires Playwright and a browser. It uses a normal installed `playwright` package, or the bundled Codex runtime on this Windows device. Set `PLAYWRIGHT_MODULE_PATH` and `BROWSER_CHANNEL` to override discovery. It opens local files and leaves screenshots under ignored `test-results/`:

```bash
node export-check.js
```

The site itself has no dependencies. Browser QA tooling is optional development tooling. Nothing is deployed or published by these commands. The static files can later be hosted on GitHub Pages or another static host.
