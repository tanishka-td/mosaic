from pathlib import Path
import json

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "data/raw/india-pop-2025-1km.tif"
binary = root / "data/raw/india-pop-2025-1km.f32"
header = root / "data/raw/india-pop-2025-1km.json"

image = Image.open(source)
tags = image.tag_v2
pixels = np.asarray(image, dtype="<f4")
pixels.tofile(binary)
tie = tags[33922]
scale = tags[33550]
metadata = {
    "width": image.width,
    "height": image.height,
    "pixelScale": [float(scale[0]), float(scale[1])],
    "tiepoint": [float(v) for v in tie],
    "nodata": float(tags.get(42113, -99999)),
    "dtype": "float32-le",
    "source": "WorldPop Global 2, India, 2025 constrained, 1 km, R2025A v1",
    "sourceUrl": "https://stac.worldpop.org/collections/IND/items/ind_pop_2025_CN_1km_R2025A_UA_v1",
    "license": "CC BY 4.0",
}
header.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
print(f"Extracted {image.width} × {image.height} population pixels to {binary}")
