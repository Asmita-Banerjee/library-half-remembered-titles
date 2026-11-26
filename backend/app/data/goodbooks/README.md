# Extended catalogue data

`goodbooks_catalog.csv.gz` is derived from [goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k)
by Zygmunt Zając, licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-sa/4.0/).

Changes: series suffixes split from titles, authors split into a list, ISBN-10 zero-padded,
reader shelf tags filtered (non-genre shelves such as "to-read" removed, top 14 kept), and a genre and
readership label derived from the most-used tags. This derived file is shared under the same
CC BY-SA 4.0 licence. Regenerate it with `python backend/scripts/build_goodbooks.py <raw-csv-dir>`.
