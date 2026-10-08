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

export type AdminFinanceSource = {
  id: string;
  name: string;
  type: string;
  /** Minor units (plain number — see src/lib/money.ts's bigIntMinorToNumber). */
  amount: number;
  status: string;
  recoups: boolean;
  recoupmentPosition: number | null;
  recoupmentPremiumBps: number | null;
  order: number;
};

export type AdminSlateMember = {
  projectId: string;
  order: number;
  project: {
    id: string;
    slug: string;
    title: string;
    productionCompany: string;
  };
};

export type AdminSlate = {
  id: string;
  slug: string;
  title: string;
  overview: string | null;
  aboutContent: string | null;
  themeId: string;
  accentColor: string | null;
  fontId: string | null;
  isPublished: boolean;
  projects: AdminSlateMember[];
  recoupmentStructure: string | null;
  recoupmentNote: string | null;
  disclaimerText: string | null;
  financeDisplayCurrency: string;
};

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
  approximateBudget: string | null;
  idealShootWindow: string | null;
  documents: AdminDocument[];
  gallery: AdminGalleryItem[];
  references: AdminReferenceLink[];
  _count: { downloads: number };
  currency: string | null;
  /** Minor units (plain number), or null if unset — see src/lib/money.ts. */
  grossBudget: number | null;
  equitySought: number | null;
  minimumTicket: number | null;
  financeUpdatedAt: string | null;
  financeSources: AdminFinanceSource[];
};

export type AdminFxRate = {
  id: string;
  from: string;
  to: string;
  /** Prisma.Decimal serializes to a plain decimal string over JSON. */
  rate: string;
  asOfDate: string;
};
