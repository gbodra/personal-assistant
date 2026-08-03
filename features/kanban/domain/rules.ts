import type { LaneKey } from "./types"

export function canArchiveFromLane(laneKey: LaneKey): boolean {
  return laneKey === "done"
}

export const DEFAULT_LANE_DEFS: {
  key: LaneKey
  name: string
  position: number
}[] = [
  { key: "inbox", name: "Inbox", position: 0 },
  { key: "todo", name: "To do", position: 1 },
  { key: "doing", name: "Doing", position: 2 },
  { key: "done", name: "Done", position: 3 },
  { key: "canceled", name: "Canceled", position: 4 },
]

export const POSITION_GAP = 1024

export function midpoint(before: number | null, after: number | null): number {
  if (before == null && after == null) {
    return POSITION_GAP
  }
  if (before == null) {
    return after! / 2
  }
  if (after == null) {
    return before + POSITION_GAP
  }
  return (before + after) / 2
}

export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before == null || after == null) {
    return false
  }
  return after - before < 0.000001
}
