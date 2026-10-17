import registry from '../catalog/builds.json'

// Explicit build permissions are separate from automatic public release discovery.
export interface BuildTool {
  id: string
  name: string
  description: string
  build: {
    enabled: boolean
    repository: string
    sourceTagPrefix: string
    artifacts: { filename: string; platform: string }[]
  }
}
export const tools = registry as BuildTool[]
