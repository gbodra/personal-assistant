# Integration adapter template

Copy this folder when adding a new external integration (Google Calendar, Slack, etc.).

1. Implement `IntegrationAdapter` in `adapter.ts`
2. Register it in `integrations/registry.ts` (create when needed)
3. Subscribe to `lib/events` domain events if the integration reacts to app changes
