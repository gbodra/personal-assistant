export type IntegrationAdapter = {
  id: string
  name: string
  sync?: () => Promise<void>
  onEvent?: (event: { type: string; payload: unknown }) => Promise<void>
}

export const integrationTemplate: IntegrationAdapter = {
  id: "template",
  name: "Integration template",
  async sync() {
    // Implement vendor sync here.
  },
  async onEvent() {
    // React to domain events here.
  },
}
