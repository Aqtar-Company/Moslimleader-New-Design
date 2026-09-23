#!/usr/bin/env python3
"""Measure whether مَدَد can be trusted before a child uses it.

    python3 eval/run_eval.py                      # retrieval + refusal only (no model needed)
    python3 eval/run_eval.py --llm                # also generate answers with Ollama
    python3 eval/run_eval.py --llm --model qwen2.5:3b

Retrieval checks are exact. The --llm checks are only a smoke test (does the
answer contain an expected word, does it cite a source); the answers it saves
to eval/report-*.json must still be READ by a teacher — that is the real test.
"""

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

from engine.curriculum import load_chunks  # noqa: E402
from engine.ollama import OllamaClient  # noqa: E402
from engine.retrieval import Index, load_synonyms  # noqa: E402
from engine.tutor import NOT_IN_CURRICULUM, Tutor, TutorConfig  # noqa: E402


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--questions", default=str(HERE / "eval" / "questions.json"))
    p.add_argument("--curriculum", default=str(HERE / "curriculum"))
    p.add_argument("--llm", action="store_true")
    p.add_argument("--model", default="gemma3:4b")
    p.add_argument("--ollama", default="http://127.0.0.1:11434")
    p.add_argument("--mode", default="explain")
    args = p.parse_args()

    _, chunks = load_chunks(Path(args.curriculum))
    llm = OllamaClient(args.ollama, args.model)
    if args.llm and not llm.health()["ok"]:
        sys.exit(llm.health()["error"])
    tutor = Tutor(Index(chunks, load_synonyms(Path(args.curriculum) / "synonyms.txt")), llm, TutorConfig())
    cases = json.loads(Path(args.questions).read_text(encoding="utf-8"))

    rows, passed = [], 0
    for c in cases:
        hits = tutor.retrieve(c["q"], [], None, None)
        got = hits[0].chunk.lesson.id if hits else "refuse"
        want = c.get("expect_lesson", c.get("expect"))
        ok = got == want
        row = {"q": c["q"], "want": want, "got": got, "retrieval_ok": ok}

        if args.llm:
            t0 = time.time()
            answer = "".join(e["text"] for e in tutor.answer(c["q"], mode=args.mode) if e["type"] == "token")
            row.update(answer=answer, seconds=round(time.time() - t0, 1))
            if want != "refuse":
                missing = [w for w in c.get("must_include", []) if w not in answer]
                row["missing_words"] = missing
                row["cites_source"] = "[1]" in answer or "[2]" in answer
                ok = ok and not missing
            else:
                ok = ok and answer == NOT_IN_CURRICULUM

        row["ok"] = ok
        passed += ok
        rows.append(row)
        extra = f"  {row.get('seconds', '')}s" if args.llm else ""
        print(f"{'✓' if ok else '✗'}  {c['q']:<40}  → {got}{extra}")

    print(f"\n{passed}/{len(cases)} passed")
    if args.llm:
        out = HERE / "eval" / f"report-{args.model.replace(':', '_')}-{time.strftime('%Y%m%d-%H%M%S')}.json"
        out.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"answers saved for teacher review: {out}")
    sys.exit(0 if passed == len(cases) else 1)


if __name__ == "__main__":
    main()
