import os
import pymupdf

source_path = r"D:\Techomie-Flow\output\pdf\QT-1151-Rev-0-Adithyaa-A4-Aligned.pdf"
output_path = r"D:\Techomie-Flow\output\pdf\QT-1151-Rev-0-Adithyaa-A4-1x1-Photos.pdf"

source = pymupdf.open(source_path)
output = pymupdf.open()
output.insert_pdf(source)
metadata = source.metadata.copy()
metadata["title"] = "QT-1151 Rev 0 - Adithyaa - A4 with 1:1 Product Photos"
metadata["subject"] = "A4-aligned quotation with square 1:1 product-photo frames and no image stretching"
output.set_metadata(metadata)
output.save(output_path, garbage=4, deflate=True)
output.close()
source.close()

check = pymupdf.open(output_path)
assert len(check) == 6
assert all(abs(page.rect.width - 595) < 1 and abs(page.rect.height - 842) < 1 for page in check)
check.close()
print(output_path, os.path.getsize(output_path))
