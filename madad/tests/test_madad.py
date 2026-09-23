"""python3 -m unittest discover -s tests   (from the madad/ directory)"""

import json
import sys
import threading
import unittest
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from engine.arabic import normalize, tokenize  # noqa: E402
from engine.curriculum import load_chunks  # noqa: E402
from engine.retrieval import Index, load_synonyms  # noqa: E402
from engine.server import serve  # noqa: E402
from engine.tutor import NOT_IN_CURRICULUM, Tutor, TutorConfig  # noqa: E402


class FakeLLM:
    model = "fake"

    def __init__(self):
        self.calls = []

    def chat_stream(self, messages, options=None):
        self.calls.append(messages)
        yield "البسط هو الرقم الذي فوق الخط "
        yield "[1]"


def make_tutor():
    lessons, chunks = load_chunks(ROOT / "curriculum")
    llm = FakeLLM()
    return lessons, Tutor(Index(chunks, load_synonyms(ROOT / "curriculum" / "synonyms.txt")), llm, TutorConfig()), llm


class ArabicTests(unittest.TestCase):
    def test_normalize_hamza_taa_diacritics_digits(self):
        self.assertEqual(normalize("إِسْلامٌ"), "اسلام")
        self.assertEqual(normalize("مدرسة"), "مدرسه")
        self.assertEqual(normalize("٣/٥"), "3/5")

    def test_tokenize_drops_article_and_dialect_question_words(self):
        self.assertEqual(tokenize("يعني ايه البسط؟"), ["بسط"])
        self.assertEqual(tokenize("ما هي الثغور"), ["ثغور"])


class RetrievalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lessons, cls.tutor, _ = make_tutor()

    def top(self, q, **kw):
        hits = self.tutor.retrieve(q, [], kw.get("grade"), kw.get("subject"))
        return hits[0].chunk.lesson.id if hits else None

    def test_eval_set_passes(self):
        cases = json.loads((ROOT / "eval" / "questions.json").read_text(encoding="utf-8"))
        for c in cases:
            want = c.get("expect_lesson")
            with self.subTest(q=c["q"]):
                self.assertEqual(self.top(c["q"]), want)

    def test_subject_filter(self):
        self.assertIsNone(self.top("ما هو البسط", subject="science"))

    def test_follow_up_keeps_topic(self):
        history = [{"role": "user", "content": "ما هي الكسور المتكافئة؟"},
                   {"role": "assistant", "content": "..."}]
        hits = self.tutor.retrieve("طيب هات مثال تاني", history, None, None)
        self.assertTrue(hits)
        self.assertEqual(hits[0].chunk.lesson.id, "grade-4/math/fractions")


class TutorTests(unittest.TestCase):
    def test_out_of_curriculum_never_calls_model(self):
        _, tutor, llm = make_tutor()
        events = list(tutor.answer("ما عاصمة اليابان؟"))
        self.assertEqual(llm.calls, [])
        self.assertEqual("".join(e["text"] for e in events if e["type"] == "token"), NOT_IN_CURRICULUM)
        self.assertFalse(events[0]["grounded"])

    def test_grounded_prompt_contains_lesson_and_mode(self):
        _, tutor, llm = make_tutor()
        events = list(tutor.answer("ما هو البسط؟", mode="hint"))
        self.assertTrue(events[0]["grounded"])
        system = llm.calls[0][0]["content"]
        self.assertIn("[1]", system)
        self.assertIn("البسط", system)
        self.assertIn("لا تعطِ الإجابة النهائية", system)

    def test_unknown_mode_falls_back(self):
        _, tutor, llm = make_tutor()
        list(tutor.answer("ما هو البسط؟", mode="<script>"))
        self.assertIn("خطوة بخطوة", llm.calls[0][0]["content"])


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        lessons, tutor, _ = make_tutor()
        cls.httpd = serve(tutor, lessons, lambda: {"ok": True, "model": "fake"}, "127.0.0.1", 0)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_catalog_and_page(self):
        cat = json.load(urllib.request.urlopen(self.base + "/api/catalog"))
        self.assertEqual({g["id"] for g in cat["grades"]}, {"grade-4", "grade-5"})
        html = urllib.request.urlopen(self.base + "/").read().decode("utf-8")
        self.assertIn("مَدَد", html)

    def test_ask_streams_ndjson(self):
        req = urllib.request.Request(self.base + "/api/ask", method="POST",
                                     data=json.dumps({"question": "ما هو البسط"}).encode(),
                                     headers={"Content-Type": "application/json"})
        lines = urllib.request.urlopen(req).read().decode("utf-8").strip().splitlines()
        events = [json.loads(l) for l in lines]
        self.assertEqual(events[0]["type"], "sources")
        self.assertEqual(events[-1]["type"], "done")

    def test_empty_question_rejected(self):
        req = urllib.request.Request(self.base + "/api/ask", method="POST",
                                     data=b'{"question": "  "}',
                                     headers={"Content-Type": "application/json"})
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req)
        self.assertEqual(cm.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
