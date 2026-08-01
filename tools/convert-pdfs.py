#!/usr/bin/env python3
"""
One-time conversion of the Dragon Merchant Guild PDFs into workspace Markdown.

Run once:  python3 tools/convert-pdfs.py

This is workspace PREPARATION, not an application feature. Knowledge Terminal
reads Markdown and must stay subject-agnostic, so `pdftotext` never becomes a
dependency of the app itself. The script lives in the repo so the conversion is
reproducible and reviewable, not because the app calls it.

pdftotext -layout output for these particular documents is very regular:
  - a title line, then `Key: value` metadata lines  -> YAML frontmatter
  - section headings alone on a line, followed by a blank line
  - bullets as `     • item`, principles as `✓ item`
  - a lone indented line between blanks used as a pull-quote
  - bare page numbers, deeply indented, appearing mid-paragraph
  - a form feed (\\x0c) glued to the first line of every page
"""
from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "documents"
OUT = ROOT / "workspace/dragon-merchant-guild"

NBSP = " "


@dataclass
class Doc:
    pdf: str
    out: str  # path relative to the workspace root
    title: str
    number: str
    kind: str
    summary: str
    tags: list[str] = field(default_factory=list)
    part: str | None = None
    # Headings matching these become level 2; other detected headings become level 3.
    h2_patterns: list[str] = field(default_factory=list)
    # Wiki-links written into the frontmatter as `related:`.
    related: list[str] = field(default_factory=list)
    # True for the dossier-style documents (bestiary, codex, roadmap) that use
    # `Label\nValue` blocks. Elsewhere the same shape is a section heading
    # followed directly by its prose, and the two cannot be told apart from
    # layout alone — so which one a document uses is declared, not guessed.
    fields: bool = False


# `part` and the explicit titles are spelled out because the filenames do not
# disambiguate: three files share document number 02, and two different files
# are both called "AI Collaboration Guide" (documents 04 and 11).
DOCS: list[Doc] = [
    Doc("Project Charter & Design Principles", "documentation/01-project-charter.md",
        "Project Charter & Design Principles", "01", "charter",
        "Why this project exists, what success means, and the principles governing every later decision.",
        ["charter", "principles"],
        h2_patterns=[r"^\d+\.\s+\S"],
        related=["03-curriculum-integration-guide", "08-implementation-roadmap"]),

    Doc("Game Design Document (GDD) [Part I]", "documentation/02-game-design-document-part-1.md",
        "Game Design Document — Part I", "02", "design",
        "The game's premise, core loop and player fantasy.", ["gdd", "design"], part="I",
        h2_patterns=[r"^\d+\.\s+\S"],
        related=["02-game-design-document-part-2", "06-dragon-codex"]),

    Doc("Game Design Document (GDD) [Part II]", "documentation/02-game-design-document-part-2.md",
        "Game Design Document — Part II", "02", "design",
        "Systems, economy and progression.", ["gdd", "design"], part="II",
        h2_patterns=[r"^\d+\.\s+\S"],
        related=["02-game-design-document-part-1", "02-game-design-document-part-3"]),

    Doc("Game Design Document (GDD) [PART III]", "documentation/02-game-design-document-part-3.md",
        "Game Design Document — Part III", "02", "design",
        "Long-term structure, endgame and presentation layers.", ["gdd", "design"], part="III",
        h2_patterns=[r"^\d+\.\s+\S"],
        related=["02-game-design-document-part-2", "08-implementation-roadmap"]),

    Doc("Curriculum Integration Guide", "documentation/03-curriculum-integration-guide.md",
        "Curriculum Integration Guide", "03", "guide",
        "How each curriculum module earns its place as a mechanic in the game.",
        ["curriculum", "guide"],
        h2_patterns=[r"^\d+\.\s+\S"],
        related=["01-project-charter", "08-implementation-roadmap"]),

    Doc("AI Collaboration Guide", "documentation/04-ai-collaboration-guide.md",
        "AI Collaboration Guide", "04", "guide",
        "Rules for working with AI without outsourcing the learning. Superseded by document 11.",
        ["ai", "guide"],
        h2_patterns=[r"^\d+\.\s+\S"],
        related=["11-ai-collaboration-guide-v2"]),

    Doc("Development Workflow & Session Guide", "documentation/05-development-workflow.md",
        "Development Workflow & Session Guide", "05", "guide",
        "What a development session looks like from open to close.", ["workflow", "guide"],
        h2_patterns=[r"^\d+\.\s+\S"],
        related=["09-project-journal"]),

    Doc("Dragon Codex", "documentation/06-dragon-codex.md",
        "Dragon Codex", "06", "worldbuilding",
        "The universal laws governing dragonkind — biology, temperament, and the rules every species obeys.",
        ["worldbuilding", "dragons"],
        h2_patterns=[r"^\d+\.\s+\S", r"^Law\b", r"^Part\s+\w+"],
        related=["07-dragon-bestiary-part-1", "07-dragon-bestiary-part-2"], fields=True),

    Doc("Dragon Bestiary Part I", "documentation/07-dragon-bestiary-part-1.md",
        "Dragon Bestiary — Part I", "07", "worldbuilding",
        "Species dossiers: the Stonejaw Drake and its kin.",
        ["worldbuilding", "dragons", "bestiary"], part="I",
        h2_patterns=[r"^Species\s+\d+"],
        related=["06-dragon-codex", "07-dragon-bestiary-part-2"], fields=True),

    Doc("Dragon Bestiary Part II", "documentation/07-dragon-bestiary-part-2.md",
        "Dragon Bestiary — Part II", "07", "worldbuilding",
        "Species dossiers continued: Riverveil, Hearthscale and Emberclaw.",
        ["worldbuilding", "dragons", "bestiary"], part="II",
        h2_patterns=[r"^Species\s+\d+"],
        related=["06-dragon-codex", "07-dragon-bestiary-part-1"], fields=True),

    Doc("Implementation Roadmap", "roadmap/08-implementation-roadmap.md",
        "Implementation Roadmap", "08", "roadmap",
        "The milestone ladder, each rung gated on a curriculum module.", ["roadmap", "milestones"],
        h2_patterns=[r"^Milestone\s+\d+", r"^\d+\.\s+\S"],
        related=["03-curriculum-integration-guide", "01-project-charter"], fields=True),

    Doc("Project Journal", "journal/09-project-journal.md",
        "Project Journal", "09", "journal",
        "The running development log — what was built, what broke, what was learned.", ["journal"],
        h2_patterns=[r"^Entry\s+\d+", r"^\d+\.\s+\S"],
        related=["05-development-workflow", "10-meeting-minutes"]),

    Doc("Dragon Merchant Guild Meeting Minutes", "meeting-minutes/10-meeting-minutes.md",
        "Meeting Minutes", "10", "minutes",
        "Why decisions were made. Consult this before overturning any of them.",
        ["minutes", "decisions"],
        h2_patterns=[r"^Meeting\s+\d+", r"^\d+\.\s+\S"],
        related=["09-project-journal", "01-project-charter"]),

    Doc("AI Collaboration Guide [2]", "documentation/11-ai-collaboration-guide-v2.md",
        "AI Collaboration Guide (v2)", "11", "guide",
        "A later rewrite of the AI guide. Supersedes document 04.", ["ai", "guide"],
        h2_patterns=[r"^\d+\.\s+\S"],
        related=["04-ai-collaboration-guide"]),
]

META_RE = re.compile(r"^(Project|Document Version|Status|Version|Date|Author)\s*:\s*(.+)$")
BULLET_RE = re.compile(r"^\s*[•▪◦]\s+(.*)$")
CHECK_RE = re.compile(r"^\s*[✓✔]\s+(.*)$")
NUM_LIST_RE = re.compile(r"^\s{2,}(\d+)[.)]\s+(.*)$")
PAGE_NO_RE = re.compile(r"^\s{10,}\d{1,3}\s*$")
SUBSEC_RE = re.compile(r"^\d+\.\d+(\.\d+)?\s+\S")
ENDS_SENTENCE = re.compile(r"[.,;:!?—]$")
LIST_ITEM_RE = re.compile(r"^(-\s|\d+\.\s)")
# pdftotext -layout renders table columns as runs of 3+ spaces.
COL_SPLIT_RE = re.compile(r" {3,}")

# Words that mean a short line is a wrapped fragment, not a heading.
CONTINUATION_TAIL = ("and", "or", "the", "a", "of", "to", "in", "for", "with", "that")

# A "field" is the `Label\nValue` pattern the dossiers and the roadmap use, e.g.
#   Scientific Name
#   Terradraco ferrumandibula
# Without special handling the label (followed by a non-blank line) fails the
# heading test while the value (followed by a blank) passes it — so the label
# vanishes and its value is promoted to a heading. Exactly inverted.
MAX_FIELD_LABEL = 40
MAX_FIELD_VALUE = 110


def cells(line: str) -> list[str]:
    return [c.strip() for c in COL_SPLIT_RE.split(line.strip()) if c.strip()]


def table_block(body: list[str], start: int) -> tuple[list[list[str]], int] | None:
    """
    Collect a table starting at `start`, or None.

    Rows in these PDFs are separated by blank lines, so a run of blanks is
    tolerated between rows but two consecutive non-table lines end the block.
    """
    header = cells(body[start])
    if len(header) < 2 or not body[start][:1].isspace():
        return None

    rows = [header]
    i = start + 1
    last_row_index = start
    while i < len(body):
        line = body[i]
        if not line.strip():
            i += 1
            continue
        row = cells(line)
        if len(row) != len(header) or not line[:1].isspace():
            break
        rows.append(row)
        last_row_index = i
        i += 1

    # One header alone is not a table; it is just an indented line.
    if len(rows) < 2:
        return None
    return rows, last_row_index


def merge_label_headings(text: str) -> str:
    """
    Collapse `### Label` immediately followed by `### Value` into `**Label** — Value`.

    The roadmap and the dossiers use a label/value pair separated by blank lines:

        Curriculum

        Module 1 — C# Fundamentals

    Both lines pass the heading test (each is short and followed by a blank), so
    both become headings and the pairing is lost. An h3 with no body before the
    next h3 is always this pattern in these documents — a genuinely empty section
    does not occur.
    """
    lines = text.split("\n")
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^### (.+)$", line)
        if m and len(m.group(1)) <= 28:
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            m2 = re.match(r"^### (.+)$", lines[j]) if j < len(lines) else None
            if m2:
                out.append(f"**{m.group(1)}** — {m2.group(1)}")
                out.append("")
                i = j + 1
                continue
        out.append(line)
        i += 1
    return "\n".join(out)


def render_table(rows: list[list[str]]) -> list[str]:
    header, *body_rows = rows
    out = ["| " + " | ".join(header) + " |"]
    out.append("|" + "|".join("---" for _ in header) + "|")
    out.extend("| " + " | ".join(r) + " |" for r in body_rows)
    return out


def extract(pdf: Path) -> list[str]:
    text = subprocess.run(
        ["pdftotext", "-layout", str(pdf), "-"],
        check=True, capture_output=True, text=True,
    ).stdout
    # The form feed matters: pdftotext glues \x0c to the first line of each page,
    # and Python counts it as whitespace — which made every heading that happened
    # to start a page look like an indented continuation line instead.
    lines = [ln.replace(NBSP, " ").replace("\x0c", "").rstrip() for ln in text.split("\n")]
    return [ln for ln in lines if not PAGE_NO_RE.match(ln)]


def is_heading(line: str, nxt: str, doc: Doc) -> bool:
    """A heading is short, unpunctuated, at column 0, and followed by a blank line."""
    s = line.strip()
    if not s or line[:1].isspace():
        return False
    if any(re.match(p, s) for p in doc.h2_patterns):
        return True
    if SUBSEC_RE.match(s):
        return True
    if len(s) > 64 or ENDS_SENTENCE.search(s):
        return False
    # In dossier documents a heading must be followed by a blank line, because
    # `short line -> non-blank line` is how their Label/Value fields look.
    # Documents without fields put section headings directly above their prose.
    if doc.fields and nxt.strip():
        return False
    return s[0].isupper() and not s.endswith(CONTINUATION_TAIL)


def heading_level(line: str, doc: Doc) -> int:
    s = line.strip()
    if any(re.match(p, s) for p in doc.h2_patterns):
        return 2
    if SUBSEC_RE.match(s):
        return 3
    return 2 if re.match(r"^\d+\.\s+\S", s) else 3


def strip_number(s: str) -> str:
    return re.sub(r"^(\d+(\.\d+)*)[.)]?\s+", "", s).strip()


def frontmatter(doc: Doc, meta: dict[str, str]) -> list[str]:
    fm = ["---", f"title: {doc.title}", f'document: "{doc.number}"', f"kind: {doc.kind}"]
    if doc.part:
        fm.append(f"part: {doc.part}")
    if meta.get("Status"):
        fm.append(f"status: {meta['Status']}")
    if meta.get("Document Version"):
        fm.append(f'version: "{meta["Document Version"]}"')
    fm.append("summary: >-")
    fm.append(f"  {doc.summary}")
    fm.append("tags: [" + ", ".join(doc.tags) + "]")
    if doc.related:
        fm.append("related:")
        fm.extend(f'  - "[[{r}]]"' for r in doc.related)
    fm.append(f'source: "documents/{doc.pdf}.pdf"')
    fm.append("---")
    return fm


def convert(doc: Doc) -> str:
    lines = extract(SRC / f"{doc.pdf}.pdf")

    # ── harvest the metadata block, then skip past it ──────────────────────
    meta: dict[str, str] = {}
    body_start = 1  # line 0 is the document's own title
    for i, ln in enumerate(lines[:30]):
        m = META_RE.match(ln.strip())
        if m:
            meta[m.group(1)] = m.group(2).strip()
            body_start = i + 1

    out: list[str] = [*frontmatter(doc, meta), "", f"# {doc.title}", ""]

    para: list[str] = []
    in_list = False

    def separate_from_list() -> None:
        """Anything following a list needs a blank line, or Markdown folds it in."""
        if out and LIST_ITEM_RE.match(out[-1]):
            out.append("")

    def flush_para() -> None:
        nonlocal para
        if not para:
            return
        separate_from_list()
        out.append(" ".join(para))
        out.append("")
        para = []

    body = lines[body_start:]
    skip_until = -1

    for i, raw in enumerate(body):
        if i <= skip_until:
            continue

        nxt = body[i + 1] if i + 1 < len(body) else ""
        stripped = raw.strip()

        if not stripped:
            flush_para()
            in_list = False
            continue

        # ── tables ──────────────────────────────────────────────────────────
        if found := table_block(body, i):
            rows, end = found
            flush_para()
            separate_from_list()
            in_list = False
            out.append("")
            out.extend(render_table(rows))
            out.append("")
            skip_until = end
            continue

        # ── Label / Value field blocks ──────────────────────────────────────
        if (
            doc.fields
            and not raw[:1].isspace()
            and nxt.strip()
            and len(stripped) <= MAX_FIELD_LABEL
            and stripped[0].isupper()
            and not ENDS_SENTENCE.search(stripped)
            and not any(re.match(p, stripped) for p in doc.h2_patterns)
            and not SUBSEC_RE.match(stripped)
        ):
            after = body[i + 2] if i + 2 < len(body) else ""
            # Label followed by a bullet list: bold the label, let the list follow.
            if BULLET_RE.match(nxt) or CHECK_RE.match(nxt) or NUM_LIST_RE.match(nxt):
                flush_para()
                separate_from_list()
                out.append("")
                out.append(f"**{stripped}**")
                out.append("")
                in_list = False
                continue
            # Label followed by a single short value, then a blank.
            value = nxt.strip()
            if not after.strip() and 0 < len(value) <= MAX_FIELD_VALUE:
                flush_para()
                separate_from_list()
                out.append(f"**{stripped}** — {value}")
                out.append("")
                in_list = False
                skip_until = i + 1
                continue

        if b := BULLET_RE.match(raw):
            flush_para()
            out.append(f"- {b.group(1).strip()}")
            in_list = True
            continue

        if c := CHECK_RE.match(raw):
            flush_para()
            # A ✓ line in these documents states a principle, not a done task.
            out.append(f"- **{c.group(1).strip()}**")
            in_list = True
            continue

        if n := NUM_LIST_RE.match(raw):
            flush_para()
            out.append(f"{n.group(1)}. {n.group(2).strip()}")
            in_list = True
            continue

        # An indented line while a list is open continues the previous item.
        if in_list and raw[:1].isspace() and not is_heading(raw, nxt, doc):
            if out and LIST_ITEM_RE.match(out[-1]):
                out[-1] = f"{out[-1]} {stripped}"
                continue

        if is_heading(raw, nxt, doc):
            flush_para()
            separate_from_list()
            in_list = False
            out.append("")
            out.append("#" * heading_level(raw, doc) + " " + strip_number(stripped))
            out.append("")
            continue

        # A lone indented line surrounded by blanks is a pull-quote in these docs.
        prev = body[i - 1] if i > 0 else ""
        if (
            len(raw) - len(raw.lstrip()) >= 6
            and not prev.strip()
            and not nxt.strip()
            and not in_list
            and len(stripped) < 120
        ):
            flush_para()
            separate_from_list()
            out.append(f"> {stripped}")
            out.append("")
            continue

        para.append(stripped)

    flush_para()

    text = "\n".join(out)
    text = merge_label_headings(text)
    # Documents whose sections are unnumbered produce only level-3 headings,
    # which leaves them with no top level at all and an outline that starts one
    # rung too deep. If nothing reached level 2, the level-3 headings ARE the
    # top level — promote them so the table of contents reads correctly.
    if "\n## " not in text:
        text = re.sub(r"^### ", "## ", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def main() -> int:
    if not SRC.is_dir():
        print(f"error: {SRC} not found", file=sys.stderr)
        return 1

    for doc in DOCS:
        pdf = SRC / f"{doc.pdf}.pdf"
        if not pdf.is_file():
            print(f"skip (missing): {pdf.name}", file=sys.stderr)
            continue
        target = OUT / doc.out
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(convert(doc), encoding="utf8")
        print(f"{doc.out:<58} {len(target.read_text().splitlines()):>5} lines")
    return 0


if __name__ == "__main__":
    sys.exit(main())
