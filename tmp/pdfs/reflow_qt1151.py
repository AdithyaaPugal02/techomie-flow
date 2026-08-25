import os
import pymupdf

SOURCE = r"C:\Users\Admin\Downloads\QT-1151-Rev-0-Adithyaa.pdf"
OUTPUT = r"D:\Techomie-Flow\output\pdf\QT-1151-Rev-0-Adithyaa-A4-Aligned.pdf"

A4 = pymupdf.paper_rect("a4")
MARGIN = 18


def fit_rect(width, height, box):
    scale = min(box.width / width, box.height / height)
    w, h = width * scale, height * scale
    x = box.x0 + (box.width - w) / 2
    y = box.y0 + (box.height - h) / 2
    return pymupdf.Rect(x, y, x + w, y + h)


def place_full(out, src, page_number, clip=None, margin=MARGIN, stretch=False):
    page = out.new_page(width=A4.width, height=A4.height)
    source_page = src[page_number]
    clip = clip or source_page.rect
    box = pymupdf.Rect(margin, margin, A4.width - margin, A4.height - margin)
    target = box if stretch else fit_rect(clip.width, clip.height, box)
    page.show_pdf_page(target, src, page_number, clip=clip, keep_proportion=not stretch)


def place_consolidated(out, src):
    page = out.new_page(width=A4.width, height=A4.height)
    # The final product fragments are at the top of source page 5; the commercial
    # summary begins partway down source page 6. Stack both on one balanced A4 page.
    upper = pymupdf.Rect(0, 0, src[4].rect.width, 310)
    lower = pymupdf.Rect(0, 292, src[5].rect.width, src[5].rect.height)
    gap = 8
    usable = pymupdf.Rect(MARGIN, MARGIN, A4.width - MARGIN, A4.height - MARGIN)
    scale = min(usable.width / upper.width, (usable.height - gap) / (upper.height + lower.height))
    total_h = (upper.height + lower.height) * scale + gap
    top = usable.y0 + (usable.height - total_h) / 2
    left = (A4.width - upper.width * scale) / 2
    page.show_pdf_page(
        pymupdf.Rect(left, top, left + upper.width * scale, top + upper.height * scale),
        src, 4, clip=upper, keep_proportion=True,
    )
    lower_top = top + upper.height * scale + gap
    page.show_pdf_page(
        pymupdf.Rect(left, lower_top, left + lower.width * scale, lower_top + lower.height * scale),
        src, 5, clip=lower, keep_proportion=True,
    )


os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
src = pymupdf.open(SOURCE)
out = pymupdf.open()

# Cover: remove the accidental white strip at the foot while keeping the design intact.
place_full(out, src, 0, pymupdf.Rect(0, 0, src[0].rect.width, 790), margin=0, stretch=True)
place_full(out, src, 1)
place_full(out, src, 2)
place_full(out, src, 3)
place_consolidated(out, src)
place_full(out, src, 7)

out.set_metadata({**src.metadata, "title": "QT-1151 Rev 0 - Adithyaa - A4 Aligned"})
out.save(OUTPUT, garbage=4, deflate=True)
out.close()
src.close()
print(OUTPUT)
