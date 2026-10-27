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

For automated builds, register the source repository, runner, and ZIP filenames in `catalog/builds.json`. Each source repository provides a `.github/actions/build-release` composite action accepting a `version` input.

Source publish commands push a tag and send `repository_dispatch` (`event_type: release`, payload: `tool`, `tag`, `sha`) using the local GitHub CLI login. The public `Release` workflow reads the pinned source with the `SOURCE_TOKEN` secret, builds, and publishes. It can also be started manually with an existing source tag.

The `Site` workflow automatically deploys the download site to GitHub Pages.

Release publication, edits and removal use `Refresh site` to dispatch `Site` on the default branch. Release tags never deploy directly to the protected `github-pages` environment. Completed tool builds also refresh the site through `workflow_run`; failed builds do not deploy.
