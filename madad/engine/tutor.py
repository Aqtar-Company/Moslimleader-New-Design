"""The tutor: retrieve from the curriculum, then let the model explain ONLY that.

Two guards keep a small model from teaching something wrong:

1. No retrieval, no model. If nothing in the curriculum matches the question
   well enough, the answer is a fixed "not in my lessons" message and the model
   is never called. A small model asked about a topic it has no text for is
   exactly where it invents things.
2. The system prompt restricts the model to the numbered excerpts it was given
   and asks it to cite them, so the child (and the parent reading the log) can
   see which lesson every answer came from.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Protocol

from .retrieval import Hit, Index

NOT_IN_CURRICULUM = (
    "هذا السؤال ليس في الدروس الموجودة عندي الآن، ولا أريد أن أخمّن فأعلّمك شيئًا غير صحيح. "
    "اسأل معلمك أو والديك عنه، أو اختر مادة أو صفًّا آخر من الأعلى إن كان السؤال من درس آخر."
)

SYSTEM_PROMPT = """أنت «مَدَد»، معلّم صبور ولطيف لتلاميذ المرحلة الابتدائية. تتكلم بالعربية الفصحى البسيطة وجمل قصيرة.

قواعد لا تُخالَف:
1. اعتمد فقط على «مقتطفات الدروس» المرقّمة أدناه. لا تضف معلومة ليست فيها.
2. إذا لم تكفِ المقتطفات للإجابة فقل بوضوح: «هذا ليس في دروسي» ولا تخمّن.
3. اذكر رقم المقتطف الذي أخذت منه بين قوسين مربعين مثل [1].
4. لا تطلب من التلميذ أي معلومات شخصية، ولا تتحدث في موضوعات غير الدراسة.
5. شجّع التلميذ، ولا تقل له أبدًا إنه غبي أو إن سؤاله سهل.

مقتطفات الدروس:
{context}"""

MODE_INSTRUCTIONS = {
    "explain": (
        "اشرح للتلميذ خطوة بخطوة في فقرات قصيرة، واستخدم مثالًا من الدرس. "
        "اختم بسؤال واحد قصير يتأكد به التلميذ أنه فهم."
    ),
    "hint": (
        "لا تعطِ الإجابة النهائية. أعطِ تلميحًا واحدًا فقط من الدرس، "
        "ثم اسأل التلميذ سؤالًا يقوده ليصل إلى الإجابة بنفسه."
    ),
    "quiz": (
        "اكتب ٣ أسئلة اختيار من متعدد من المقتطفات فقط، لكل سؤال ٣ اختيارات (أ، ب، ج). "
        "بعد الأسئلة اكتب سطر «الإجابات:» ثم الإجابة الصحيحة لكل سؤال مع سبب قصير."
    ),
}
DEFAULT_MODE = "explain"


class ChatModel(Protocol):
    model: str

    def chat_stream(self, messages: list[dict], options: dict | None = None) -> Iterator[str]: ...


@dataclass
class TutorConfig:
    top_k: int = 4
    min_coverage: float = 0.34   # share of the question's terms the best excerpt must contain
    temperature: float = 0.2     # low: we want the lesson restated, not creativity
    num_ctx: int = 4096
    max_history_turns: int = 6
    log_dir: Path | None = None


def format_context(hits: list[Hit]) -> str:
    blocks = []
    for i, h in enumerate(hits, 1):
        l = h.chunk.lesson
        head = f"[{i}] {l.subject} — {l.title}" + (f" — {h.chunk.heading}" if h.chunk.heading else "")
        blocks.append(f"{head}\n{h.chunk.text}")
    return "\n\n".join(blocks)


def source_payload(hits: list[Hit]) -> list[dict]:
    return [{
        "n": i,
        "chunk_id": h.chunk.id,
        "lesson_id": h.chunk.lesson.id,
        "title": h.chunk.lesson.title,
        "heading": h.chunk.heading,
        "subject": h.chunk.lesson.subject,
        "grade": h.chunk.lesson.grade,
        "source": h.chunk.lesson.source,
        "reviewed": h.chunk.lesson.reviewed,
        "score": round(h.score, 3),
    } for i, h in enumerate(hits, 1)]


class Tutor:
    def __init__(self, index: Index, llm: ChatModel, config: TutorConfig | None = None):
        self.index = index
        self.llm = llm
        self.cfg = config or TutorConfig()

    def retrieve(self, question: str, history: list[dict], grade_id: str | None,
                 subject_id: str | None) -> list[Hit]:
        hits = self.index.search(question, self.cfg.top_k, grade_id, subject_id)
        if self._grounded(hits):
            return hits
        # Follow-ups like "طيب ومثال تاني؟" name no topic. Retry with the
        # previous question attached so the conversation keeps its lesson.
        prev = next((m["content"] for m in reversed(history) if m.get("role") == "user"), None)
        if prev:
            hits = self.index.search(f"{prev} {question}", self.cfg.top_k, grade_id, subject_id)
            if self._grounded(hits):
                return hits
        return []

    def _grounded(self, hits: list[Hit]) -> bool:
        return bool(hits) and hits[0].coverage >= self.cfg.min_coverage

    def build_messages(self, question: str, hits: list[Hit], mode: str,
                       history: list[dict]) -> list[dict]:
        system = SYSTEM_PROMPT.format(context=format_context(hits))
        system += "\n\nطريقة الإجابة المطلوبة الآن: " + MODE_INSTRUCTIONS[mode]
        msgs = [{"role": "system", "content": system}]
        for m in history[-self.cfg.max_history_turns:]:
            if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str):
                msgs.append({"role": m["role"], "content": m["content"][:2000]})
        msgs.append({"role": "user", "content": question})
        return msgs

    def answer(self, question: str, *, mode: str = DEFAULT_MODE, grade_id: str | None = None,
               subject_id: str | None = None, history: list[dict] | None = None) -> Iterator[dict]:
        """Yields events: sources → token* → done (or error)."""
        history = history or []
        mode = mode if mode in MODE_INSTRUCTIONS else DEFAULT_MODE
        started = time.time()
        hits = self.retrieve(question, history, grade_id, subject_id)
        yield {"type": "sources", "sources": source_payload(hits), "grounded": bool(hits)}

        if not hits:
            yield {"type": "token", "text": NOT_IN_CURRICULUM}
            yield {"type": "done", "grounded": False}
            self._log(question, mode, grade_id, subject_id, hits, NOT_IN_CURRICULUM, started, None)
            return

        parts: list[str] = []
        error = None
        try:
            for piece in self.llm.chat_stream(
                self.build_messages(question, hits, mode, history),
                {"temperature": self.cfg.temperature, "num_ctx": self.cfg.num_ctx},
            ):
                parts.append(piece)
                yield {"type": "token", "text": piece}
        except Exception as e:  # noqa: BLE001 — surfaced to the UI, never swallowed
            error = str(e)
            yield {"type": "error", "message": error}
        yield {"type": "done", "grounded": True}
        self._log(question, mode, grade_id, subject_id, hits, "".join(parts), started, error)

    def _log(self, question, mode, grade_id, subject_id, hits, answer, started, error):
        """Local JSONL log so a parent or teacher can review what was taught.

        Stays on this machine. It is the raw material for checking answer
        quality before the product is ever put in front of more children.
        """
        if not self.cfg.log_dir:
            return
        self.cfg.log_dir.mkdir(parents=True, exist_ok=True)
        rec = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "model": getattr(self.llm, "model", "?"),
            "mode": mode, "grade": grade_id, "subject": subject_id,
            "question": question, "grounded": bool(hits),
            "sources": [h.chunk.id for h in hits],
            "answer": answer, "error": error,
            "seconds": round(time.time() - started, 2),
        }
        with open(self.cfg.log_dir / f"{time.strftime('%Y-%m-%d')}.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
