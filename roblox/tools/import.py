"""Import reviewed literal objects from Delivery's TypeScript catalogues. No TS code runs."""
import argparse
import ast
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "src" / "data"
OUTPUT = ROOT / "src/shared/Catalogue.luau"
LOCK = ROOT / "tools/reviewed.sha256"
BANNED = re.compile(r"\b(fuck\w*|shit\w*|bitch\w*|damn|hell|sext\w*|crush|flirt\w*|romance|romantic|dating|kiss\w*|married|gun|kill|suicide)\b", re.I)
APPROVED = """v2-favorite-child v3-two-phone-calls v2-mirror-argument v3-camera-relationship v2-muted-scream v2-chat-dad v3-skip-how-to-move v2-sponsor-mom v2-loot-goblin v2-friendly-fire v2-boss-second-phase v3-bot-custody v3-photo-audit v2-reply-everyone v3-birthday-without-me v2-final-boss-refund v2-royal-laundry v3-door-single-combat v2-evil-laugh v2-apology-draft v2-tutorial-betrayal v2-training-dummy v2-birthday-investigation""".split()
SKIP = {"v3-soft-threat", "v2-romantic-disaster", "v2-hero-last-stand", "v2-villain-crack"}
MEASURES = {
    "v2-polite-fury": "quiet", "v2-forbidden-whisper": "quiet", "v2-quiet-winner": "quiet",
    "v3-documentary-scandal": "quiet", "v3-bedtime-catastrophe": "quiet",
    "v2-deadpan-evidence": "pause", "v3-sports-final": "pause", "v3-horror-realization": "pause",
    "v2-tiny-emergency": "quiet",
}
PACKS = {"gaming": "Control Room", "streamer-mode": "Backstage", "wildcard": "Backstage"}


def field(block, key):
    match = re.search(r"\b" + key + r""":\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')""", block)
    if not match:
        raise ValueError(f"Missing {key}")
    return ast.literal_eval(match[1])


def objects(source, first_field):
    return re.findall(r'\{\s*id: "[^"]+",\s*' + first_field + r':[\s\S]*?\n  \}', source)


def load():
    lines, directions, selected = [], [], set()
    for filename in ("content", "classic-content-v2"):
        source = (SOURCE / f"{filename}.ts").read_text(encoding="utf8")
        for block in objects(source, "line"):
            key = field(block, "id")
            if key in APPROVED and key not in selected:
                if field(block, "rating") != "everyone" or field(block, "category") == "romance":
                    raise ValueError(key)
                selected.add(key)
                lines.append(dict(id=key, text=field(block, "line"), pack=PACKS.get(field(block, "category"), "Small Disasters")))
        if filename == "content":
            for block in objects(source, "shortLabel"):
                key = field(block, "id")
                if key not in SKIP:
                    directions.append(dict(id=key, label=field(block, "shortLabel"), text=field(block, "instruction"), measure=MEASURES.get(key, "crowd")))
    if selected != set(APPROVED):
        raise ValueError("A reviewed web line disappeared")
    for key, label, instruction, measure in [
        ("rb-slow", "Museum tour", "Take your time. Give every word its own display case.", "slow"),
        ("rb-fast", "Closing doors", "Get the whole announcement out before the elevator closes.", "fast"),
        ("rb-rise", "Balcony seats", "Start quietly. Let the ending carry to the back row.", "rise"),
        ("rb-fall", "Sleeping stagehand", "Begin at speaking level. Let the last few words fall to a whisper.", "fall"),
    ]:
        directions.append(dict(id=key, label=label, text=instruction, measure=measure))
    for row in (ROOT / "tools/lines.txt").read_text(encoding="utf8").splitlines():
        if row.startswith("["):
            pack = row[1:-1]
        elif row.strip():
            key = "rb-" + hashlib.sha256(row.encode()).hexdigest()[:12]
            lines.append(dict(id=key, text=row, pack=pack))
    return lines, directions


def validate(lines, directions):
    if len(lines) < 120 or len(directions) < 30:
        raise ValueError("Launch catalogue is too small")
    ids = set()
    for item in lines + directions:
        if item["id"] in ids or BANNED.search(item["text"] + " " + item.get("label", "")):
            raise ValueError(item["id"])
        ids.add(item["id"])
    if len({l["text"].casefold() for l in lines}) != len(lines):
        raise ValueError("Repeated line")
    for line in lines:
        if not 10 <= len(line["text"].split()) <= 18:
            raise ValueError("Length: " + line["text"])
    for d in directions:
        if d["measure"] not in {"quiet", "pause", "slow", "fast", "rise", "fall", "crowd"}:
            raise ValueError("Missing measure: " + d["id"])


def render(items):
    return "\n".join("\t\t{ " + ", ".join(k + " = " + json.dumps(v, ensure_ascii=False) for k, v in row.items()) + " }," for row in items)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--approve", action="store_true", help="refresh fingerprint after manually screening every changed line")
    args = parser.parse_args()
    lines, directions = load()
    validate(lines, directions)
    data = "--!strict\n-- Generated by tools/import.py\nreturn {\n\tlines = {\n" + render(lines) + "\n\t},\n\tdirections = {\n" + render(directions) + "\n\t},\n}\n"
    digest = hashlib.sha256(data.encode()).hexdigest()
    if args.approve:
        LOCK.write_text(digest + "\n")
    if LOCK.read_text().strip() != digest:
        raise ValueError("Reviewed content has changed")
    if args.check:
        if OUTPUT.read_text(encoding="utf8") != data:
            raise ValueError("Stale generated module")
    else:
        OUTPUT.write_text(data, encoding="utf8")
    print(f"{len(lines)} lines, {len(directions)} directions, unique IDs, approved text and measure specs passed")


if __name__ == "__main__":
    main()
