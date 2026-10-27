import { expect, test } from 'bun:test'

async function workflow(name: string) {
  return Bun.YAML.parse(
    await Bun.file(new URL(`../.github/workflows/${name}.yml`, import.meta.url)).text(),
  ) as Record<string, any>
}

test('Pages deploys the default branch without invoking historical release-tag workflows', async () => {
  const site = await workflow('pages')

  // Release tags retain their original workflow definitions. Retire the old
  // workflow ID instead of trying to change its deployment ref via checkout.
  expect(site.on.release).toBeUndefined()
  expect(Object.keys(site.on)).toEqual(
    expect.arrayContaining(['push', 'pull_request', 'workflow_dispatch', 'workflow_run']),
  )
  expect(site.on.push.branches).toEqual(['main'])
  expect(site.on.workflow_run.workflows).toEqual(['Release'])
  expect(site.on.workflow_run.types).toEqual(['completed'])
  expect(await Bun.file(new URL('../.github/workflows/site.yml', import.meta.url)).exists()).toBe(false)
  expect(await Bun.file(new URL('../.github/workflows/refresh-site.yml', import.meta.url)).exists()).toBe(false)
})

test('site PR checks cannot deploy or gain dispatch permissions, and failed tool builds do not refresh Pages', async () => {
  const site = await workflow('pages')
  expect(site.permissions).toEqual({ contents: 'read' })
  expect(site.jobs.build.permissions?.actions).toBeUndefined()
  expect(site.jobs.build.if).toContain("github.event.workflow_run.conclusion == 'success'")
  expect(site.jobs.deploy.if).toBe("github.event_name != 'pull_request'")
  expect(site.jobs.deploy.environment.name).toBe('github-pages')
  expect(site.jobs.deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' })
})
