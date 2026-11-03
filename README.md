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

## G-Wolf Toolkit usage notice

Tool package downloads show a versioned usage and attribution notice. Confirmation is remembered locally for the exact policy version and text; checksum files and other tools do not use this notice. The application's first-use confirmation is independent, so direct GitHub downloads remain covered by the application's own prompt.

The source of the text is the tool repository's `legal/` folder. To sync a new agreement version locally, run `bun scripts/sync-gwolf-legal.ts <path-to-g-wolf-toolkit/legal>`. Commit the generated snapshot and `current.json` together. Existing version snapshots cannot be overwritten with different text; bump the policy version before changing terms. The site builds these snapshots without a runtime dependency on the source repository or GitHub availability.

## Releases

Publish releases with tags such as `tool-name/v1.0.0`. The site automatically groups releases by tool and lists their download assets.

Use `Tool Name v1.0.0` as the release title. Put concise user-facing changes in `notes/<tool-id>/<version>.md`; publishing uses that file, or the registered description when no changelog exists. Keep installation instructions in the packaged README. Release bodies do not append build metadata or source identifiers.

For automated builds, register the source repository, runner, and ZIP filenames in `catalog/builds.json`. Each source repository provides a `.github/actions/build-release` composite action accepting a `version` input.

G-Wolf Toolkit uses `g-wolf-toolkit/v...` tags. The `df-assembly-tool` identifier is retained as a registry alias for historical build requests and catalogue grouping; old releases and links remain valid. Version 0.1.20 also has a one-time `df-assembly-tool/v0.1.20` upgrade entry with the same checked ZIP for clients whose updater only recognises the old prefix. It is not marked latest; future builds publish only the canonical tag. Keep both prefixes grouped on the site and prefer canonical assets for the same version.

Source publish commands push a tag and send `repository_dispatch` (`event_type: release`, payload: `tool`, `tag`, `sha`) using the local GitHub CLI login. The public `Release` workflow reads the pinned source with the `SOURCE_TOKEN` secret, builds, and publishes. It can also be started manually with an existing source tag.

The `Site` workflow automatically deploys the download site to GitHub Pages.

The active workflow is `.github/workflows/pages.yml`. It deploys main-branch pushes, manual runs and successful tool builds (`workflow_run`). Failed builds and pull requests do not deploy. The browser reads Releases on page load, so editing or removing a release updates the displayed catalogue without a deployment.

The previous `site.yml` workflow is disabled in GitHub Actions: historical release tags still contain its old release trigger, and changing main cannot change those tagged definitions. Keep that old workflow ID disabled; use `Site` / `pages.yml` for manual rebuilds. The `github-pages` environment continues to permit only the `main` branch.
