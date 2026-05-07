import { prisma } from './prisma';

// Attribute a freshly-created order to a marketing campaign by coupon code.
// Best-effort: never throws into the order flow — any failure is logged and
// swallowed. The order itself succeeded; attribution is metadata.
//
// Idempotent at two levels:
//   1. CampaignRecipient row is updated with WHERE orderId IS NULL, so two
//      concurrent calls can't double-count.
//   2. The conversionCount increment is gated on that update affecting a row.
export async function attributeOrderToCampaign(args: {
  orderId: string;
  couponCode: string | null | undefined;
  userId: string;
}): Promise<void> {
  const { orderId, userId } = args;
  const code = args.couponCode?.trim().toUpperCase();
  if (!code) return;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { couponCode: code } });
    if (!campaign) return;

    const recipient = await prisma.campaignRecipient.findFirst({
      where: { campaignId: campaign.id, userId, orderId: null },
      select: { id: true },
    });
    if (!recipient) return;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.campaignRecipient.updateMany({
        where: { id: recipient.id, orderId: null },
        data: { orderId },
      });
      if (updated.count > 0) {
        await tx.campaign.update({
          where: { id: campaign.id },
          data: { conversionCount: { increment: 1 } },
        });
      }
    });
  } catch (err) {
    console.error('attributeOrderToCampaign failed', { orderId, code, err });
  }
}
