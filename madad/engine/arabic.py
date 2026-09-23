"""Arabic text normalisation and tokenisation for retrieval.

Children type without diacritics, mix hamza forms, write ة as ه and ask in
Egyptian dialect ("يعني ايه البسط؟"). Retrieval must treat all of those as the
same words the curriculum uses, so both sides go through `tokenize()`.
"""

import re

_TASHKEEL = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭ]")
_TATWEEL = "ـ"
_TOKEN = re.compile(r"\w+", re.UNICODE)

_CHAR_MAP = str.maketrans({
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
    "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه",
    **{a: str(i) for i, a in enumerate("٠١٢٣٤٥٦٧٨٩")},
    **{a: str(i) for i, a in enumerate("۰۱۲۳۴۵۶۷۸۹")},
})

# Definite-article prefixes, longest first. Only stripped when a real word remains.
_PREFIXES = ("وال", "بال", "كال", "فال", "لل", "ال")

# Written already normalised (ة→ه, ى→ي, no hamza on alef).
# Includes question words, instruction verbs and common Egyptian dialect,
# because they carry no topic and would otherwise match every lesson.
_STOPWORDS = frozenset("""
من في على الي الى عن ما ماذا هل هو هي هم هن انا انت نحن هذا هذه ذلك تلك التي الذي الذين
ان او ام ثم كيف لماذا لما متي اين كم مع كل بين عند قد لا لم لن ليس لي له لها و ف ب ك ل يا
اشرح وضح فسر عرف اذكر قل قولي اعطني اريد ممكن من فضلك لو سمحت معني يعني
ايه ازاي ليه امتي فين كام ده دي دا اللي عايز عاوز عايزه عاوزه بتاع بتاعه مش طب طيب
درس الدرس سوال جواب اجابه
""".split())


def normalize(text: str) -> str:
    text = _TASHKEEL.sub("", text).replace(_TATWEEL, "")
    return text.translate(_CHAR_MAP).lower()


def stem(token: str) -> str:
    """Very light stemmer: definite article and the sound feminine plural.

    Deliberately conservative. An aggressive stemmer merges unrelated words
    (وزن → زن), and a wrong match is worse than a missed one here: a miss
    becomes an honest "not in my lessons", a wrong match feeds the model an
    unrelated lesson.
    """
    for p in _PREFIXES:
        if token.startswith(p) and len(token) - len(p) >= 2:
            token = token[len(p):]
            break
    if len(token) >= 5 and token.endswith("ات"):
        token = token[:-2]
    return token


def tokenize(text: str, keep_stopwords: bool = False) -> list[str]:
    out = []
    for tok in _TOKEN.findall(normalize(text)):
        if tok == "_" or (not keep_stopwords and tok in _STOPWORDS):
            continue
        tok = stem(tok)
        if len(tok) < 2 and not tok.isdigit():
            continue
        if not keep_stopwords and tok in _STOPWORDS:
            continue
        out.append(tok)
    return out
