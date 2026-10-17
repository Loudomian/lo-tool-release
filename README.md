# LO Tool Release

A shared build and release hub for LO tools, with an Astro download site powered by GitHub Releases.

## Development

Requires Bun 1.4+.

```sh
bun install --frozen-lockfile
bun run dev
```

Local site: <http://127.0.0.1:4321/>.

## Build

```sh
bun run sync      # Update the release snapshot
bun run verify    # Run tests, type checks, and build
bun run preview   # Preview the build locally
```

Build output: `dist/`. Use `bun run build` to build without running checks.

## Releases

Publish releases with tags such as `tool-name/v1.0.0`. The site automatically groups releases by tool and lists their download assets.

Use `Tool Name v1.0.0` as the release title and put a short description in the first paragraph of the release notes.

Build configuration lives in `catalog/builds.json` and `.github/workflows/`. GitHub Actions builds and deploys the site to GitHub Pages.
