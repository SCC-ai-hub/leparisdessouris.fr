"""A4 print sheets: 4 QR codes per row, as many rows as fit on the page."""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[2]
QR_DIR = ROOT / "QR-codes"
OUT_DIR = ROOT / "QR-codes" / "print"
OUT_PDF = OUT_DIR / "qr-sheets-a4.pdf"

COLS = 4
MARGIN = 12 * mm
GAP = 6 * mm


def main() -> None:
    files = [QR_DIR / f"{i:02d}.png" for i in range(1, 41)]
    missing = [p for p in files if not p.exists()]
    if missing:
        raise SystemExit(f"missing QR files: {missing[:3]}...")

    page_w, page_h = A4
    usable_w = page_w - 2 * MARGIN
    cell_w = (usable_w - GAP * (COLS - 1)) / COLS
    # Keep QR aspect (~792x828); fit width, compute height
    sample_ratio = 828 / 792
    cell_h = cell_w * sample_ratio

    usable_h = page_h - 2 * MARGIN
    rows_per_page = int((usable_h + GAP) // (cell_h + GAP))
    if rows_per_page < 1:
        rows_per_page = 1
    per_page = rows_per_page * COLS

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT_PDF), pagesize=A4)

    for idx, path in enumerate(files):
        slot = idx % per_page
        if idx > 0 and slot == 0:
            c.showPage()

        row = slot // COLS
        col = slot % COLS
        x = MARGIN + col * (cell_w + GAP)
        # top-down rows
        y = page_h - MARGIN - (row + 1) * cell_h - row * GAP

        c.drawImage(
            str(path),
            x,
            y,
            width=cell_w,
            height=cell_h,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )

    c.save()
    pages = (len(files) + per_page - 1) // per_page
    print(
        f"wrote {OUT_PDF} | {COLS} cols × {rows_per_page} rows/page "
        f"| {per_page}/page | {pages} page(s) | {len(files)} codes"
    )


if __name__ == "__main__":
    main()
