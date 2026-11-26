"""Build the extended catalogue from the goodbooks-10k dataset.

Source: https://github.com/zygmuntz/goodbooks-10k (CC BY-SA 4.0), which holds
metadata and user shelf tags for the 10,000 most-rated books on Goodreads.

    python scripts/build_goodbooks.py <dir with books.csv, tags.csv, book_tags.csv>

Writes app/data/goodbooks/goodbooks_catalog.csv.gz. Nothing is invented: every
field is copied or derived mechanically (genre / audience from the book's own
most-used shelf tags; junk shelves such as "to-read" are dropped).
"""

from __future__ import annotations

import csv
import gzip
import re
import sys
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "app" / "data" / "goodbooks" / "goodbooks_catalog.csv.gz"
MAX_TAGS = 14

JUNK = re.compile(
    r"(read|^own|owned|i-own|favou?rit|^fav|faves|book|kindle|e-?book|librar|shelf|wish|buy|audio|audible|"
    r"tbr|dnf|finish|abandon|borrow|default|calibre|nook|^have|^mine$|want|maybe|star|review|unread|club|"
    r"group|overdrive|hardcover|paperback|^arc$|^other$|^general|recommend|listened|\d|hold|^lit$|^english|"
    r"^usa$|^american$|^novels?$|^fiction$|^adult$|^literature$|^series$|part-of|first-in|stand-alone|"
    r"must|^to-|gave-up|couldn|didn|on-my|my-|^me$|^re-|^sff?$|^sf-|^ya$|^contemporary$|^drama$|"
    r"author|^lit-|^e-|^ebooks?$|^classic$|^mystery-?$|^fantasy-|^scifi-|^sci-fi-|-sci-?fi$|-fantasy$)"
)

GENRES = [
    ({"fantasy", "urban-fantasy", "high-fantasy", "epic-fantasy", "magic", "dark-fantasy"}, "Fantasy"),
    ({"science-fiction", "sci-fi", "scifi", "space", "space-opera"}, "Science Fiction"),
    ({"dystopian", "dystopia", "post-apocalyptic"}, "Dystopian"),
    ({"mystery", "mysteries", "crime", "detective", "murder-mystery", "mystery-thriller", "crime-fiction",
      "cozy-mystery", "mystery-suspense", "mystery-crime", "crime-mystery"}, "Mystery"),
    ({"thriller", "thrillers", "suspense", "suspense-thriller", "crime-thriller", "psychological-thriller"},
     "Thriller"),
    ({"horror", "paranormal", "supernatural", "vampires", "zombies"}, "Horror & Paranormal"),
    ({"romance", "chick-lit", "contemporary-romance", "paranormal-romance", "historical-romance", "love"},
     "Romance"),
    ({"historical-fiction", "historical"}, "Historical Fiction"),
    ({"classics", "classic-literature", "victorian", "19th-century"}, "Classic Fiction"),
    ({"biography", "memoir", "memoirs", "biography-memoir", "biographies", "autobiography"},
     "Biography & Memoir"),
    ({"poetry", "poems"}, "Poetry"),
    ({"graphic-novels", "graphic-novel", "comics", "manga", "comic"}, "Graphic Novel"),
    ({"humor", "humour", "comedy", "funny", "satire"}, "Humour"),
    ({"non-fiction", "nonfiction", "non-fic", "history", "philosophy", "psychology", "self-help", "business",
      "science", "religion", "politics", "economics", "spirituality", "christian", "writing", "health"},
     "Non-fiction"),
    ({"contemporary-fiction", "literary-fiction", "realistic-fiction", "literary", "modern-fiction",
      "chick-lit", "women-s-fiction", "womens-fiction"}, "Contemporary Fiction"),
    ({"childrens", "children", "children-s", "kids", "picture-books", "children-s-books", "childrens-books",
      "juvenile", "middle-grade"}, "Children's Fiction"),
    ({"young-adult", "teen", "ya-fiction", "young-adult-fiction", "ya-fantasy", "teen-fiction"},
     "Young Adult"),
]
CHILD = {"childrens", "children", "children-s", "kids", "picture-books", "children-s-books", "childrens-books",
         "juvenile", "middle-grade", "kids-books", "children-s-literature", "childhood-books"}
YA = {"young-adult", "ya", "teen", "ya-fiction", "young-adult-fiction", "ya-fantasy", "teen-fiction",
      "ya-books", "ya-lit", "high-school"}
SERIES = re.compile(r"\s*\(([^()]*?),?\s*#[\d.\-]+\)\s*$")


def main(src: Path) -> None:
    tag_names = {r["tag_id"]: r["tag_name"] for r in csv.DictReader(open(src / "tags.csv", encoding="utf-8"))}
    raw: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for r in csv.DictReader(open(src / "book_tags.csv", encoding="utf-8")):
        raw[r["goodreads_book_id"]].append((tag_names[r["tag_id"]], int(r["count"])))

    rows = []
    for b in csv.DictReader(open(src / "books.csv", encoding="utf-8")):
        tags_all = sorted(raw.get(b["goodreads_book_id"], []), key=lambda t: -t[1])
        names = [t for t, _ in tags_all]
        top = names[:40]
        genre = next((label for t in top for keys, label in GENRES
                      if t in keys and label not in ("Young Adult", "Children's Fiction")), None)
        if genre is None:
            genre = next((label for t in top for keys, label in GENRES if t in keys), "Fiction")
        ci = next((i for i, t in enumerate(top) if t in CHILD), 99)
        yi = next((i for i, t in enumerate(top) if t in YA), 99)
        audience = "General" if min(ci, yi) > 25 else ("Children" if ci < yi else "Young Adult")
        clean = []
        for t in names:
            if t.isascii() and not JUNK.search(t) and t not in clean:
                clean.append(t)
            if len(clean) >= MAX_TAGS:
                break
        full = b["title"].strip()
        m = SERIES.search(full)
        series = m.group(1).strip() if m else ""
        title = SERIES.sub("", full).strip() or (b["original_title"] or "").strip()
        original_title = (b["original_title"] or "").strip()
        year = b["original_publication_year"]
        year = int(float(year)) if year else ""
        isbn = (b["isbn"] or "").strip()
        if isbn and isbn.lower() != "nan":
            isbn = isbn.zfill(10)
        else:
            isbn = ""
        rows.append({
            "goodbooks_id": b["book_id"],
            "goodreads_id": b["goodreads_book_id"],
            "title": title,
            "original_title": original_title if original_title != title else "",
            "series": series,
            "authors": "|".join(a.strip() for a in b["authors"].split(",") if a.strip()),
            "year": year,
            "isbn": isbn,
            "language": b["language_code"],
            "average_rating": b["average_rating"],
            "ratings_count": b["ratings_count"],
            "genre": genre,
            "audience": audience,
            "tags": "|".join(clean),
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} books to {OUT}")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "."))
