// الخطوة 1: السكريبت الخام -> مشاهد + برومبتات Veo جاهزة
import Anthropic from '@anthropic-ai/sdk';
import { CONFIG, planClips } from '../config.mjs';
import { characterBlock, negativePrompt } from '../lib/character.mjs';
import { log } from '../lib/log.mjs';

const SCENE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['hook', 'scenes'],
  properties: {
    hook: {
      type: 'string',
      description: 'أقوى جملة في السكريبت — أول 2 ثانية. بالعربي.',
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'veoPrompt', 'arabicLine', 'onScreenText'],
        properties: {
          index: { type: 'integer' },
          veoPrompt: {
            type: 'string',
            description:
              'English prompt for the video model. Camera framing + action + lighting + mood. One continuous shot, no cuts.',
          },
          arabicLine: {
            type: 'string',
            description: 'السطر المنطوق في المشهد ده، بالعربي الفصيح المبسّط.',
          },
          onScreenText: {
            type: 'string',
            description: 'نص السَبتايتل المعروض — مختصر، 8 كلمات كحد أقصى.',
          },
          negative: {
            type: 'string',
            description: 'أي حاجة إضافية مش عايزينها في المشهد ده تحديداً. اختياري.',
          },
        },
      },
    },
  },
};

function systemPrompt(clips) {
  const count = clips.length;
  const durations = clips.map((c, i) => `المشهد ${i}: ${c.useSeconds} ثانية`).join('، ');
  const avg = clips.reduce((s, c) => s + c.useSeconds, 0) / count;

  return `أنت مخرج ريلز محترف. شغلك: تحوّل سكريبت عربي خام إلى ${count} مشاهد بصرية جاهزة لموديل توليد فيديو.

مدد المشاهد محددة سلفاً وغير قابلة للتغيير — ${durations}.
وزّع الكلام على المشاهد بما يناسب مدة كل مشهد: المشهد الأقصر ياخد كلام أقل.

قواعد صارمة:
1. بالظبط ${count} مشهد — لا أكثر ولا أقل.
2. كل مشهد لقطة واحدة متصلة. ممنوع تكتب "ثم" أو "cut to" جوه المشهد الواحد.
3. المشهد الأول هو الخُطّاف (hook): لازم يوقف الإصبع في أول ثانيتين. ابدأ بالحركة أو بالسؤال، مش بالمقدمة.
4. \`veoPrompt\` بالإنجليزي دايماً — موديلات الفيديو بتفهمه أحسن بكتير. صِفه بترتيب: نوع اللقطة (close-up / medium / wide) ثم الحركة ثم الإضاءة ثم المزاج.
5. ممنوع تذكر اسم الشخصية أو وصف شكلها في \`veoPrompt\` — وصف الشخصية بيتلزق آلياً قبل كلامك. اكتب "the character" أو "she"/"he" حسب البروفايل.
6. ممنوع تطلب نص أو كتابة تظهر داخل الفيديو — السَبتايتل بيتحط بعدين في المونتاج.
7. \`arabicLine\` = الكلام المنطوق فعلاً. القاعدة: ~2.5 كلمة لكل ثانية من مدة المشهد (متوسط ${Math.round(avg * 2.5)} كلمة) — أطول من كده والكلام هيتقطع.
8. \`onScreenText\` = نفس المعنى مختصر لـ 8 كلمات كحد أقصى، يتقرا بسرعة على الموبايل.
9. المشهد الأخير لازم ينتهي بحركة مستقرة — بعده مباشرة بييجي كارت اللوجو، فأي حركة عنيفة في آخر لقطة هتبان قطع وحش.`;
}

/**
 * بيرجّع { hook, scenes[] } — كل مشهد جاهز للتوليد.
 * بيتحط في المانيفست فيُعاد استخدامه لو الفلو اتعاد.
 */
export async function breakdownScript({ character, script, clips }) {
  if (!CONFIG.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY مش متظبط في .env — الخطوة دي محتاجاه لتقسيم المشاهد.');
  }

  const plan = clips ?? planClips();
  const sceneCount = plan.length;

  const client = new Anthropic({ apiKey: CONFIG.anthropicApiKey });

  log.step(`تقسيم السكريبت إلى ${sceneCount} مشهد (${plan.map((c) => `${c.useSeconds}ث`).join(' + ')})...`);

  const response = await client.messages.create({
    model: CONFIG.breakdownModel,
    max_tokens: 16000,
    system: systemPrompt(plan),
    output_config: {
      format: { type: 'json_schema', schema: SCENE_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              '## بروفايل الشخصية (للسياق فقط — ما تكررهاش في البرومبت):',
              JSON.stringify(character.profile, null, 2),
              '',
              '## السكريبت الخام:',
              script.body,
              script.notes ? `\n## ملاحظات إخراجية:\n${script.notes}` : '',
            ].join('\n'),
          },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`الموديل رفض تقسيم السكريبت: ${response.stop_details?.explanation || 'بدون تفسير'}`);
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('مفيش رد نصي من موديل التقسيم.');

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error(`رد التقسيم مش JSON صالح:\n${textBlock.text.slice(0, 500)}`);
  }

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error('التقسيم رجع من غير مشاهد.');
  }

  if (parsed.scenes.length !== sceneCount) {
    log.warn(`الموديل رجّع ${parsed.scenes.length} مشهد بدل ${sceneCount} — هنتعامل مع اللي رجع.`);
  }

  const block = characterBlock(character);

  const scenes = parsed.scenes.slice(0, sceneCount).map((s, i) => ({
    index: i,
    // المدة اللي بتتطلب من Veo (وبيتدفع فيها) مقابل المدة اللي بتظهر في الريل بعد القص
    requestSeconds: plan[i].requestSeconds,
    durationSec: plan[i].useSeconds,
    // بلوك الكاركتر بيتحط *قبل* وصف المشهد — التثبيت الأول، الحدث بعديه
    fullPrompt: `${block} ${s.veoPrompt.trim()}`,
    veoPrompt: s.veoPrompt.trim(),
    arabicLine: (s.arabicLine || '').trim(),
    onScreenText: (s.onScreenText || '').trim(),
    negative: negativePrompt(character, s.negative || ''),
    clip: null, // بيتملى في خطوة التوليد
  }));

  log.ok(`اتقسم لـ ${scenes.length} مشهد. الخُطّاف: "${parsed.hook}"`);
  return { hook: parsed.hook, scenes };
}
