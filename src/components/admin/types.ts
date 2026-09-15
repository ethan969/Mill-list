export type AdminDocument = {
  id: string;
  section: "SCRIPT" | "CREATIVE_DECK" | "FINANCIALS" | "PRODUCTION_PLAN";
  title: string;
  fileName: string;
  fileSize: number | null;
  order: number;
  createdAt: string;
};

export type AdminGalleryItem = {
  id: string;
  type: "IMAGE" | "VIDEO";
  fileName: string;
  caption: string | null;
  order: number;
};

export type AdminReferenceLink = {
  id: string;
  label: string;
  url: string;
  order: number;
};

export type TeamMember = { name: string; role?: string; bio?: string };

export type AdminProject = {
  id: string;
  slug: string;
  title: string;
  productionCompany: string;
  tagline: string | null;
  logline: string | null;
  posterKey: string | null;
  logoKey: string | null;
  themeId: string;
  accentColor: string | null;
  fontId: string | null;
  landingLayout: string;
  roomLayout: string;
  isPublished: boolean;
  aboutContent: string | null;
  aboutTeam: TeamMember[] | null;
  documents: AdminDocument[];
  gallery: AdminGalleryItem[];
  references: AdminReferenceLink[];
  _count: { downloads: number };
};
