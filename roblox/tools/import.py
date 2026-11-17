"""Build src/shared/Catalogue.luau from the hand-screened text sources in tools/.

Sources (both live inside roblox/tools, nothing outside roblox/ is read):
  lines.txt       [Pack] headers, then one stage line per row: "text" or "text | noun"
  directions.txt  one direction per row: "id | Label | instruction | measure"

Usage:
  python tools/import.py            validate and write the generated module
  python tools/import.py --approve  after screening every line by hand, record the fingerprint
  python tools/import.py --check    validate, require the fingerprint and a fresh module (CI)
"""
import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LINES = ROOT / "tools/lines.txt"
DIRECTIONS = ROOT / "tools/directions.txt"
OUTPUT = ROOT / "src/shared/Catalogue.luau"
LOCK = ROOT / "tools/reviewed.sha256"

# Anything here fails the import. Words are matched whole (\b) and case-insensitively.
BANNED = re.compile(
    r"\b("
    # swearing and minced oaths
    r"fuck\w*|shit\w*|bitch\w*|bastard\w*|ass|asses|arse\w*|damn\w*|dammit|hell|heck|dang|darn\w*|crap\w*"
    r"|freak(?:ing|in)|frick\w*|piss\w*|wtf|omg|stfu|bloody|bugger\w*|suck(?:s|ed)?"
    # romance, dating, anything sexual
    r"|sex\w*|sext\w*|sexy|crush\w*|flirt\w*|romance|romantic\w*|dat(?:e|es|ing)|boyfriend\w*|girlfriend\w*"
    r"|bf|gf|kiss\w*|married|marry|marriage|wedding\w*|lover\w*|valentine\w*|rizz\w*|gyat\w*|naked|nude\w*|naughty"
    r"|smash(?:ing)? or pass|e-?dat\w*"
    # violence and harm
    r"|kill\w*|murder\w*|dead|die|died|dies|dying|death\w*|suicid\w*|self[- ]?harm|gun\w*|shoot\w*|shot"
    r"|stab\w*|blood\w*|bomb\w*|knife|knives|weapon\w*|fight\w*|punch\w*|explod\w*|explosion\w*|war|attack\w*"
    r"|hurt|torture\w*|hostage\w*|terror\w*|grave\w*|corpse\w*|zombie\w*"
    # drugs, alcohol, gambling, money and scams
    r"|drug\w*|weed|vape\w*|vaping|smok\w*|cigar\w*|beer\w*|wine|drunk|alcohol\w*|vodka|high on"
    r"|gambl\w*|casino\w*|bet|bets|betting|lottery|jackpot\w*|poker|slot machine\w*|robux|free robux|real money"
    r"|cash ?app|paypal|credit card\w*|scam\w*|hack\w*|exploit\w*|generator"
    # personal information and off-platform contact
    r"|password\w*|phone number\w*|home address|your address|real name|how old are you|what school|where do you live"
    r"|discord|snapchat|tiktok|youtube|instagram|twitch|whatsapp|telegram|dm me|add me"
    # meanness and slurs (patterns, not a full list; the Roblox filter remains the final gate)
    r"|stupid|idiot\w*|dumb|loser\w*|ugly|fatso|shut up|retard\w*|n[i1]gg\w*|f[a@]gg?\w*|tr[a@]nn\w*|sp[a@]stic"
    r"|cripple\w*|midget\w*|r[e3]tard\w*|wh[o0]re\w*|sl[u\*]t\w*"
    # crude humour
    r"|poop\w*|fart\w*|pee|peed|toilet\w*|butt|butts|booty|vomit\w*|puke\w*|diaper\w*|boogers?"
    # politics and religion
    r"|god|gods|jesus|church\w*|pray\w*|religio\w*|president\w*|election\w*|politic\w*|trump|biden"
    # named games, characters, streamers and brainrot names we do not parody by name
    r"|roblox|adopt me|brookhaven|bloxburg|grow a garden|pet simulator|blox fruits|jailbreak|arsenal|mm2"
    r"|murder mystery|minecraft|fortnite|among us|skibidi|fanum\w*|ohio|sigma|mewing|tung|sahur|tralalero"
    r"|bombardiro|crocodilo|cappuccina|brr brr|patapim|mrbeast|ishowspeed|kai cenat|toilet"
    r")\b",
    re.I,
)
# Shapes the old catalogue leaned on. Any one of them may appear, a few times at most.
TEMPLATES = {
    "object files a complaint": re.compile(r"\b(complain\w*|resign\w*|appeal\w*|filed|lawyer\w*|union|promoted)\b", re.I),
    "object makes a request": re.compile(r"\b(has|have) requested\b|\brequested\b", re.I),
    "decorative spoons and lamps": re.compile(r"\b(spoons?|decorative|lamps?)\b", re.I),
}
TEMPLATE_LIMIT = 5
MEASURES = ("quiet", "pause", "slow", "fast", "rise", "fall", "crowd")
# Main.server.luau features one of these on Pack night; keep them in the catalogue.
FEATURED = ("Spawn Point", "Checkpoint Drama", "Tycoon Problems", "Control Room", "Backstage")
MIN_LINES, MIN_DIRECTIONS = 160, 40


def rows(path):
    for number, raw in enumerate(path.read_text(encoding="utf8").splitlines(), 1):
        row = raw.strip()
        if row and not row.startswith("#"):
            yield number, row


def load():
    lines, directions, pack = [], [], None
    for number, row in rows(LINES):
        if row.startswith("["):
            if not row.endswith("]"):
                raise ValueError(f"lines.txt:{number}: bad pack header")
            pack = row[1:-1].strip()
            continue
        if pack is None:
            raise ValueError(f"lines.txt:{number}: line before the first [Pack]")
        text, _, noun = (part.strip() for part in row.partition("|"))
        item = dict(id="rb-" + hashlib.sha256(text.encode()).hexdigest()[:12], text=text, pack=pack)
        if noun:
            item["noun"] = noun
        item["_where"] = f"lines.txt:{number}"
        lines.append(item)
    for number, row in rows(DIRECTIONS):
        parts = [part.strip() for part in row.split("|")]
        if len(parts) != 4:
            raise ValueError(f"directions.txt:{number}: expected id | Label | instruction | measure")
        key, label, text, measure = parts
        directions.append(dict(id=key, label=label, text=text, measure=measure, _where=f"directions.txt:{number}"))
    return lines, directions


def words(text):
    return len(text.split())


def validate(lines, directions):
    problems = []

    def fail(item, message):
        problems.append(f"{item['_where']}: {message}: {item.get('text', '')}")

    if len(lines) < MIN_LINES or len(directions) < MIN_DIRECTIONS:
        problems.append(f"catalogue too small: {len(lines)} lines (min {MIN_LINES}), {len(directions)} directions (min {MIN_DIRECTIONS})")
    ids, texts = set(), set()
    for item in lines + directions:
        if item["id"] in ids:
            fail(item, "repeated id " + item["id"])
        ids.add(item["id"])
        if not re.fullmatch(r"[a-z0-9-]+", item["id"]):
            fail(item, "id must be lowercase letters, digits and dashes")
        for key in ("text", "label", "noun", "pack"):
            value = item.get(key, "")
            match = BANNED.search(value)
            if match:
                fail(item, f"banned word '{match[0]}' in {key}")
            if re.search(r"\d|https?:|www\.|\.com\b|@|#|[<>{}\[\]\\]", value):
                fail(item, f"digits, links or markup in {key}")
    for line in lines:
        key = line["text"].casefold()
        if key in texts:
            fail(line, "repeated line")
        texts.add(key)
        if not 6 <= words(line["text"]) <= 18:
            fail(line, f"{words(line['text'])} words (keep 6 to 18)")
        if not re.match(r"[A-Z]", line["text"]) or not re.search(r"[.!?]$", line["text"]):
            fail(line, "start with a capital and end with punctuation")
        if not re.search(r"\b(I|I'm|I've|my|me|we|our|us)\b", line["text"], re.I):
            fail(line, "stage lines are first person")
        noun = line.get("noun")
        if noun is not None and (words(noun) > 3 or noun.casefold() not in key):
            fail(line, f"noun '{noun}' must be three words or fewer and appear in the line")
    packs = Counter(line["pack"] for line in lines)
    if not 6 <= len(packs) <= 8:
        problems.append(f"{len(packs)} packs (keep 6 to 8)")
    for name in FEATURED:
        if packs[name] == 0:
            problems.append(f"featured pack '{name}' is empty")
    for name, shape in TEMPLATES.items():
        hits = [line["text"] for line in lines if shape.search(line["text"])]
        if len(hits) > TEMPLATE_LIMIT:
            problems.append(f"shape '{name}' used {len(hits)} times (max {TEMPLATE_LIMIT})")
    measures = Counter(d["measure"] for d in directions)
    for d in directions:
        if d["measure"] not in MEASURES:
            fail(d, "unknown measure " + d["measure"])
        if words(d["label"]) > 3:
            fail(d, "label over three words")
        if not d["text"].endswith(".") or re.search(r"[.!?]\s", d["text"]) or words(d["text"]) > 22:
            fail(d, "instruction must be one sentence of 22 words or fewer")
    for measure in MEASURES:
        if measures[measure] == 0:
            problems.append(f"no direction uses measure '{measure}'")
    if directions and measures["crowd"] > 0.4 * len(directions):
        problems.append(f"crowd is {measures['crowd']} of {len(directions)} directions (max forty percent)")
    if problems:
        raise SystemExit("Catalogue rejected:\n  " + "\n  ".join(problems))
    return packs, measures


def render(items, keys):
    out = []
    for row in items:
        out.append("\t\t{ " + ", ".join(k + " = " + json.dumps(row[k], ensure_ascii=False) for k in keys if k in row) + " },")
    return "\n".join(out)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail unless the module is fresh and approved")
    parser.add_argument("--approve", action="store_true", help="record the fingerprint after screening every line by hand")
    args = parser.parse_args()
    lines, directions = load()
    packs, measures = validate(lines, directions)
    data = (
        "--!strict\n-- Generated by tools/import.py from tools/lines.txt and tools/directions.txt. Do not edit by hand.\nreturn {\n\tlines = {\n"
        + render(lines, ("id", "text", "pack", "noun"))
        + "\n\t},\n\tdirections = {\n"
        + render(directions, ("id", "label", "text", "measure"))
        + "\n\t},\n}\n"
    )
    digest = hashlib.sha256(data.encode()).hexdigest()
    if args.approve:
        LOCK.write_text(digest + "\n")
    approved = LOCK.exists() and LOCK.read_text().strip() == digest
    if args.check:
        if not approved:
            raise SystemExit("Reviewed content has changed: screen every line, then run python tools/import.py --approve")
        if OUTPUT.read_text(encoding="utf8") != data:
            raise SystemExit("Stale generated module: run python tools/import.py")
    else:
        OUTPUT.write_text(data, encoding="utf8")
    print(f"{len(lines)} lines in {len(packs)} packs, {len(directions)} directions")
    print("packs: " + ", ".join(f"{name} {count}" for name, count in packs.items()))
    print("measures: " + ", ".join(f"{m} {measures[m]}" for m in MEASURES))
    if not approved:
        print("NOT APPROVED: screen every changed line, then run python tools/import.py --approve", file=sys.stderr)
        sys.exit(1)
    print("unique ids, screened text, lengths and measures passed; fingerprint approved")


if __name__ == "__main__":
    main()
