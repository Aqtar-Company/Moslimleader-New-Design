import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { FacebookAssistantSettings } from '@/app/api/admin/ai-facebook-assistant/settings/route';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const INTENT_LABELS: Record<string, string> = {
  price: 'استفسار عن السعر',
  availability: 'استفسار عن التوفر',
  shipping: 'استفسار عن الشحن',
  payment: 'استفسار عن الدفع',
  discount: 'استفسار عن خصم أو كوبون',
  complaint: 'شكوى أو مشكلة',
  order: 'متابعة طلب',
  details: 'استفسار عن تفاصيل منتج',
  wholesale: 'استفسار جملة',
  other: 'استفسار عام',
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  warm: 'استخدم أسلوبًا دافئًا وودودًا يعكس قيم مسلم ليدر في التربية والأسرة. أضف تحية لطيفة وختام مناسب.',
  formal: 'استخدم أسلوبًا رسميًا ومحترفًا مع الحفاظ على الاحترام والوضوح.',
  sales: 'استخدم أسلوبًا تسويقيًا وترويجيًا بلغة مقنعة تبرز قيمة المنتج دون مبالغة.',
};

// POST /api/ai/facebook-reply
// Called by the webhook (server-to-server, x-internal-key) or by admin UI (credentials).
export async function POST(req: NextRequest) {
  // Accept both internal calls (webhook) and admin-authenticated calls
  const internalKey = req.headers.get('x-internal-key');
  const isInternal = internalKey && internalKey === process.env.INTERNAL_API_KEY;

  if (!isInternal) {
    const { getAuthUserFromRequest } = await import('@/lib/jwt');
    const user = await getAuthUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { messageId, text, tone = 'warm', source = 'messenger' } = body as {
    messageId: string;
    text: string;
    tone: string;
    source: string;
  };

  if (!messageId || !text) {
    return NextResponse.json({ error: 'messageId and text are required' }, { status: 400 });
  }

  // Load products from DB to ground the AI in real data
  const products = await prisma.product.findMany({
    where: { inStock: true },
    select: { id: true, name: true, nameEn: true, price: true, category: true, shortDescription: true, variants: true },
    take: 30,
  });

  // Load assistant settings for escalation keywords
  const settingRow = await prisma.setting.findUnique({ where: { key: 'facebook-assistant' } });
  const settings = settingRow ? (settingRow.value as unknown as FacebookAssistantSettings) : null;
  const escalationKeywords = settings?.escalationKeywords ?? 'شكوى,غالي,لم يصل,استرجاع,نصب,إلغاء,مشكلة';

  const productList = products.map(p =>
    `- ${p.name}${p.nameEn ? ` (${p.nameEn})` : ''}: ${p.price} جنيه — ${p.shortDescription?.slice(0, 80) ?? ''}`
  ).join('\n');

  const systemPrompt = `أنت مساعد خدمة عملاء لمتجر "مسلم ليدر" المتخصص في التربية الإسلامية للأطفال والأسرة.

## دورك
- الرد على رسائل واستفسارات العملاء على فيسبوك بطريقة احترافية.
- ${TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.warm}
- استخدم اللغة العربية دائمًا.
- لا تذكر أنك ذكاء اصطناعي ما لم يسألك العميل مباشرة.

## المنتجات المتاحة حاليًا
${productList || 'لا توجد منتجات محددة متاحة الآن.'}

## تعليمات مهمة
1. لا تخترع أسعارًا أو خصومات أو معلومات مخزون — استند فقط للبيانات أعلاه.
2. إذا سأل العميل عن منتج غير موجود في القائمة، اعتذر بلطف وادعُه للتواصل للاستفسار.
3. للتعليقات على المنشورات: ردود قصيرة (2-3 جمل) وادعُ العميل للإنبوكس للتفاصيل.
4. للرسائل الخاصة: ردود أكثر تفصيلًا مع ذكر السعر والتفاصيل المتاحة.
5. إذا كانت الرسالة تحمل كلمات: ${escalationKeywords} — قل فقط كلمة واحدة: ESCALATE

## تصنيف النية (intent)
في نهاية ردك، أضف سطرًا بهذا الشكل بالضبط:
INTENT: [price|availability|shipping|payment|discount|complaint|order|details|wholesale|other]`;

  const userPrompt = source === 'comment'
    ? `تعليق على منشور فيسبوك:\n"${text}"\n\nاكتب ردًا قصيرًا للتعليق.`
    : `رسالة خاصة من عميل:\n"${text}"\n\nاكتب ردًا مناسبًا للرسالة الخاصة.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const fullText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Check if AI decided to escalate
    if (fullText.trim() === 'ESCALATE') {
      await prisma.facebookMessage.update({
        where: { id: messageId },
        data: { status: 'escalated', aiIntent: 'complaint' },
      });
      return NextResponse.json({ escalated: true });
    }

    // Extract intent from last line
    const lines = fullText.trim().split('\n');
    const intentLine = lines[lines.length - 1] ?? '';
    const intentMatch = intentLine.match(/^INTENT:\s*(\w+)/);
    const intent = intentMatch ? intentMatch[1] : 'other';
    const replyText = lines.slice(0, intentLine.startsWith('INTENT:') ? -1 : undefined).join('\n').trim();

    // Detect product mention for context
    const mentionedProduct = products.find(p =>
      text.includes(p.name) || (p.nameEn && text.toLowerCase().includes(p.nameEn.toLowerCase()))
    );

    await prisma.facebookMessage.update({
      where: { id: messageId },
      data: {
        aiReply: replyText,
        aiIntent: intent,
        relatedProduct: mentionedProduct?.name ?? null,
        status: 'draft',
      },
    });

    return NextResponse.json({ reply: replyText, intent, intentLabel: INTENT_LABELS[intent] ?? intent });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    await prisma.facebookMessage.update({
      where: { id: messageId },
      data: { status: 'failed' },
    }).catch(() => {});
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
