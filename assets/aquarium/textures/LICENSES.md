# Aquarium photographed PBR textures

These files are genuine downloaded photographic PBR texture assets, not images of
fish or a pre-rendered aquarium. They are used on three-dimensional gravel and
rock meshes. No texture request is made to a third-party server by the website.

## Source and permission

Both assets are authored by **Rob Tuytel** and distributed by **Poly Haven** under
**CC0 1.0 Universal**. Poly Haven permits commercial use and redistribution.
Credit is retained here even though the asset license does not require it.

- Mossy Rock: <https://polyhaven.com/a/mossy_rock>
- Gravel Ground 01: <https://polyhaven.com/a/gravel_ground_01>
- Poly Haven asset license: <https://polyhaven.com/license>
- CC0 1.0: <https://creativecommons.org/publicdomain/zero/1.0/>

Retrieved on 2026-10-14. The official 1K JPEG maps were downloaded without
editing from the URLs listed in `SOURCE-MANIFEST.json`.

## Maps

For each material, four maps are included:

- `diff`: photographic diffuse colour, interpreted as sRGB.
- `nor_gl`: tangent-space OpenGL normal map, interpreted as linear data.
- `arm`: red ambient occlusion, green roughness, blue metalness. The rock/gravel
  materials use ambient occlusion and roughness; their metalness remains zero.
- `disp`: height/displacement map, interpreted as linear data and applied to
  actual tessellated mesh vertices by Three.js.

## Scope and limitations

The aquarium cabinet, lamp, glass, rock base shapes, vegetation and bubbles are
original procedural **3D geometry** authored for this site. Plant blades and
stems are geometric meshes, not photographed plant scans. The rock materials
contain genuine photographic lichen and moss details; they are not separate
volumetric moss scans. The scene uses browser real-time raster rendering, not a
photographic backdrop of fish or an offline path-traced aquarium render.
