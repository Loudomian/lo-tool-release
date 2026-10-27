import { expect, test } from 'bun:test'

async function workflow(name: string) {
  return Bun.YAML.parse(
    await Bun.file(new URL(`../.github/workflows/${name}.yml`, import.meta.url)).text(),
  ) as Record<string, any>
}

test('release events dispatch Site on the default branch instead of deploying their tool tag', async () => {
  const site = await workflow('site')
  const refresh = await workflow('refresh-site')

  // This failed when release tags ran a job protected by Pages' main-only policy.
  expect(site.on.release).toBeUndefined()
  expect(Object.keys(site.on)).toEqual(
    expect.arrayContaining(['push', 'pull_request', 'workflow_dispatch', 'workflow_run']),
  )
  expect(site.on.push.branches).toEqual(['main'])
  expect(refresh.on.release.types).toEqual(['published', 'edited', 'deleted', 'unpublished'])
  const job = refresh.jobs.refresh
  expect(job.permissions).toEqual({ actions: 'write' })
  expect(job.environment).toBeUndefined()
  expect(job.steps).toHaveLength(1)
  expect(job.steps[0].env.DEFAULT_BRANCH).toBe('${{ github.event.repository.default_branch }}')
  expect(job.steps[0].run).toBe(
    'gh workflow run site.yml --repo "$GITHUB_REPOSITORY" --ref "$DEFAULT_BRANCH"',
  )
})

test('site PR checks cannot deploy or gain dispatch permissions, and failed tool builds do not refresh Pages', async () => {
  const site = await workflow('site')
  expect(site.permissions).toEqual({ contents: 'read' })
  expect(site.jobs.build.permissions?.actions).toBeUndefined()
  expect(site.jobs.build.if).toContain("github.event.workflow_run.conclusion == 'success'")
  expect(site.jobs.deploy.if).toBe("github.event_name != 'pull_request'")
  expect(site.jobs.deploy.environment.name).toBe('github-pages')
  expect(site.jobs.deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' })
})
