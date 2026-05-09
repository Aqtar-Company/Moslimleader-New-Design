import { prisma } from './prisma';

// Partners / equity-holders aggregator. Computes the cap-table summary
// (total stake, remaining company share, capital contributed) and
// returns each active partner enriched with its share of a given
// company valuation midpoint.

export interface PartnerWithShare {
  id: string;
  name: string;
  type: string;
  stakePercentage: number;
  capitalContribution: number;
  joinDate: string;
  exitDate: string | null;
  isActive: boolean;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnersSummary {
  totalCount: number;
  activeCount: number;
  totalStakePercentage: number;     // Σ active stake — should be ≤ 100
  remainingCompanyShare: number;    // 100 − Σ (or 0 if overcommitted)
  totalCapitalContribution: number;
  isOverCommitted: boolean;         // true when Σ stake > 100
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getPartnersReport(): Promise<{
  partners: PartnerWithShare[];
  summary: PartnersSummary;
}> {
  const rows = await prisma.partner.findMany({
    orderBy: [{ isActive: 'desc' }, { stakePercentage: 'desc' }],
  });

  const partners: PartnerWithShare[] = rows.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    stakePercentage: p.stakePercentage,
    capitalContribution: p.capitalContribution,
    joinDate: p.joinDate.toISOString(),
    exitDate: p.exitDate?.toISOString() ?? null,
    isActive: p.isActive,
    contactPhone: p.contactPhone,
    contactEmail: p.contactEmail,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  const active = partners.filter(p => p.isActive);
  const totalStake = active.reduce((s, p) => s + p.stakePercentage, 0);
  const totalCapital = active.reduce(
    (s, p) => s + p.capitalContribution,
    0,
  );

  return {
    partners,
    summary: {
      totalCount: partners.length,
      activeCount: active.length,
      totalStakePercentage: round2(totalStake),
      remainingCompanyShare: round2(Math.max(0, 100 - totalStake)),
      totalCapitalContribution: round2(totalCapital),
      isOverCommitted: totalStake > 100 + 0.001,
    },
  };
}

// Slim summary the valuation route includes in its metrics block —
// adds each active partner's monetary share of a supplied valuation
// midpoint so the cap-table can render in the report.
export async function getPartnerCapTable(reconciledMid: number): Promise<{
  summary: PartnersSummary;
  rows: Array<{
    id: string;
    name: string;
    type: string;
    stakePercentage: number;
    shareValue: number; // EGP — reconciledMid × stake / 100
  }>;
}> {
  const { partners, summary } = await getPartnersReport();
  const rows = partners
    .filter(p => p.isActive)
    .map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      stakePercentage: p.stakePercentage,
      shareValue: Math.round(reconciledMid * p.stakePercentage / 100),
    }));
  return { summary, rows };
}
