export type LandingLayoutId = "centered" | "split" | "full-bleed";
export type RoomLayoutId = "top-nav" | "sidebar";

export const LANDING_LAYOUTS: {
  id: LandingLayoutId;
  label: string;
  description: string;
}[] = [
  {
    id: "centered",
    label: "Centered",
    description: "Wordmark-style. Poster art sits faintly behind the title.",
  },
  {
    id: "split",
    label: "Split",
    description: "Poster fills one half of the screen; title and password sit on the other.",
  },
  {
    id: "full-bleed",
    label: "Full Bleed",
    description: "Poster fills the whole screen like a one-sheet, title over the bottom.",
  },
];

export const ROOM_LAYOUTS: {
  id: RoomLayoutId;
  label: string;
  description: string;
}[] = [
  {
    id: "top-nav",
    label: "Top Nav",
    description: "Section tabs across the top, like a pitch deck.",
  },
  {
    id: "sidebar",
    label: "Sidebar",
    description: "Section list down the left, like a document library.",
  },
];

export const DEFAULT_LANDING_LAYOUT: LandingLayoutId = "centered";
export const DEFAULT_ROOM_LAYOUT: RoomLayoutId = "top-nav";

export function isLandingLayout(v: string): v is LandingLayoutId {
  return LANDING_LAYOUTS.some((l) => l.id === v);
}

export function isRoomLayout(v: string): v is RoomLayoutId {
  return ROOM_LAYOUTS.some((l) => l.id === v);
}
