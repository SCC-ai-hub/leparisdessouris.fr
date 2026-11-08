"""Rebuild site for stands 01–40 and generate QR codes."""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from make_qr import make_qr

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
SHELL = (SITE / "js" / "page-shell.html").read_text(encoding="utf-8")
TEXTS_PATH = SITE / "data" / "texts.json"

PLACEHOLDER = {
    "ru": "Текст для стенда {n} готовится.",
    "en": "Text for stand {n} is coming soon.",
    "fr": "Le texte du panneau {n} arrive bientôt.",
    "es": "El texto del panel {n} estará pronto.",
}

# Short titles for the index (only known stands)
TITLES_RU = {
    "01": "Приветствие Зелёной Мышки",
    "02": "Мышиный Париж",
    "03": "Хранилище брата Гриньо",
    "04": "Парижский университет",
    "05": "Мышь-собирательница",
}


def migrate_texts() -> list[dict]:
    old = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    by_old_id = {e["id"]: e for e in old}
    # Map legacy 1.1..1.5 -> 01..05
    legacy_map = {f"1.{i}": f"{i:02d}" for i in range(1, 6)}

    entries: list[dict] = []
    for i in range(1, 41):
        num = f"{i:02d}"
        legacy_id = f"1.{i}" if i <= 5 else None
        src = by_old_id.get(legacy_id) if legacy_id else None
        if src and src.get("texts"):
            texts = src["texts"]
            hall = src.get("hall", "")
        else:
            texts = {k: v.format(n=num) for k, v in PLACEHOLDER.items()}
            hall = ""
        entries.append(
            {
                "id": num,
                "slug": num,
                "hall": hall,
                "texts": texts,
            }
        )
        # Also keep lookup by old ids during transition? not needed after rebuild
        _ = legacy_map
    TEXTS_PATH.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {TEXTS_PATH} ({len(entries)} entries)")
    return entries


def write_pages(entries: list[dict]) -> None:
    t_root = SITE / "t"
    if t_root.exists():
        shutil.rmtree(t_root)
    t_root.mkdir(parents=True)
    for e in entries:
        slug = e["slug"]
        html = SHELL.replace("__ID__", e["id"]).replace("__ROOT__", "../../")
        out = t_root / slug / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8", newline="\n")
    print(f"wrote {len(entries)} pages under {t_root}")


def write_index(entries: list[dict]) -> None:
    cards = []
    qr_items = []
    for e in entries:
        num = e["id"]
        title = TITLES_RU.get(num, f"Стенд {num}")
        hall = e.get("hall") or ""
        meta = f'<span class="meta"><br>зал {hall.rstrip(".")}</span>' if hall else ""
        cards.append(
            f'      <a class="card" href="t/{num}/"><span class="num">{num}</span>'
            f"<span>{title}{meta}</span></a>"
        )
        qr_items.append(
            f'      <div class="qr-item"><img src="qr/{num}.png" alt="QR {num}"><span>{num}</span></div>'
        )

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#1a1210">
  <title>Le Paris des Souris — QR texts</title>
  <style>
    :root {{
      --frame: #1a1210;
      --panel: #f3ead8;
      --pink: #e89aab;
      --blue: #3a7ec8;
      --gold: #d4a017;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      min-height: 100dvh;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      background: var(--frame);
      color: var(--panel);
      padding: 24px 18px 40px;
    }}
    .wrap {{ max-width: 720px; margin: 0 auto; }}
    h1 {{
      font-size: 1.4rem;
      margin-bottom: 0.4rem;
      letter-spacing: 0.04em;
    }}
    p.lead {{
      opacity: 0.75;
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
      line-height: 1.45;
    }}
    .list {{ display: grid; gap: 12px; }}
    a.card {{
      display: flex;
      align-items: center;
      gap: 14px;
      text-decoration: none;
      color: var(--frame);
      background: var(--panel);
      border-radius: 18px;
      padding: 14px 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
    }}
    .num {{
      width: 52px; height: 52px;
      border-radius: 50%;
      display: grid; place-items: center;
      font-weight: 700;
      background: linear-gradient(135deg, var(--pink), var(--blue), var(--gold));
      color: #fff;
      flex-shrink: 0;
    }}
    .meta {{ font-size: 0.85rem; opacity: 0.65; }}
    .qr-row {{
      margin-top: 2rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 14px;
    }}
    .qr-item {{
      background: var(--panel);
      border-radius: 16px;
      padding: 12px;
      text-align: center;
      color: var(--frame);
    }}
    .qr-item img {{ width: 100%; height: auto; border-radius: 8px; }}
    .qr-item span {{ display: block; margin-top: 8px; font-weight: 700; }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Le Paris des Souris — QR-тексты</h1>
    <p class="lead">Стенды 01–40. Отсканируйте QR или откройте страницу на телефоне.</p>
    <div class="list">
{chr(10).join(cards)}
    </div>

    <h1 style="margin-top:2rem;font-size:1.15rem">QR-коды</h1>
    <div class="qr-row">
{chr(10).join(qr_items)}
    </div>
  </div>
</body>
</html>
"""
    out = SITE / "index.html"
    out.write_text(html, encoding="utf-8", newline="\n")
    print(f"wrote {out}")


def write_qrs(base: str, entries: list[dict]) -> None:
    base = base.rstrip("/")
    out_site = SITE / "qr"
    out_root = ROOT / "QR-codes"
    if out_site.exists():
        shutil.rmtree(out_site)
    if out_root.exists():
        shutil.rmtree(out_root)
    out_site.mkdir(parents=True)
    out_root.mkdir(parents=True)
    for e in entries:
        num = e["id"]
        url = f"{base}/t/{num}/"
        make_qr(url, num, out_site / f"{num}.png")
        shutil.copy2(out_site / f"{num}.png", out_root / f"{num}.png")
    print(f"wrote {len(entries)} QR codes -> {out_site} and {out_root}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base",
        default="https://scc-ai-hub.github.io/leparisdessouris.fr",
        help="Base Pages URL, no trailing slash",
    )
    parser.add_argument("--skip-qr", action="store_true")
    args = parser.parse_args()

    entries = migrate_texts()
    write_pages(entries)
    write_index(entries)
    if not args.skip_qr:
        write_qrs(args.base, entries)


if __name__ == "__main__":
    main()
