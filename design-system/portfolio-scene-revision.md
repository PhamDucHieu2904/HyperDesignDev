# Portfolio scene revision

Paper and Graphite are preserved. This revision follows the owner's request to show their 3D, graphic design and programming work.

- Blueprint: original face reinterpreted as a ceramic/titanium android, independently composited above solid cobalt with the existing subtle grid.
- Sage: solid matcha with three floating, rounded illustrative concept cards: Illustrator label artwork, Photoshop beverage compositing, and product video/exhibition design. LUMA is a fictional concept brand, not a claimed client project.
- Gallery: red sidebar and outer frame, rounded black surface, white logo, red-lit android variation and four HTML code illustrations for app/web/game/AI. Code windows are visual illustrations, not interactive editors.

Implementation: `app/portfolio-scenes.tsx` and `app/portfolio-scenes.css`. UI/UX Pro Max's HUD guidance informed restrained accent colors, thin borders, clear text and reduced motion. Portrait scenes and copy occupy separate mobile regions. Cards move only with transform, and reduced-motion disables their floating animation.

## Image provenance and compositing

All new artwork was generated/edited with the built-in image generation tool. The original portrait was used as the identity reference. Originals remain in the Codex generated_images folder.

Assets:
- `public/hieu-android.png`: first cyan android generation (source only).
- `public/hieu-android-cutout.png`: aligned portrait RGB layer.
- `public/hieu-android-mask.png`: generated black/white luminance matte.
- `public/hieu-android-red.png`: red-lit android variant.
- `public/concept-label.png`, `public/concept-retouch.png`, `public/concept-booth.png`: the three concept card illustrations.

The generator returned RGB instead of an RGBA transparent PNG on both portrait attempts. Blueprint therefore uses the aligned RGB portrait plus the generated luminance matte; the figure is visually isolated from its background by CSS masking. The matte is embedded as a data URL at build time so masking does not need cross-origin file requests when opening index.html directly. No background-removal API or runtime server is needed. A future 3D view can replace the android-stage without altering the page layout.

The previous sage-studio.png asset is retained as an unused earlier iteration; the UI no longer references it.

## Prompts

### android

Use case: identity-preserve / style-transfer. Edit the provided portrait into a premium cinematic 3D rendered android portrait for the SAME man's designer/developer website. Preserve recognizable facial identity, swept black hair, facial proportions, calm confident expression and three-quarter head orientation. Transform the neck, shoulders and portions of the temple/jaw into sophisticated white ceramic and brushed titanium robotic anatomy, precise micro-panel seams, visible mechanical neck, fine cyan emissive circuits, subtle AI optical detail in one eye; keep much of the real face human and recognizable. Upper body bust from mid chest up, full head and full shoulders inside image, no cropped hair, centered vertical 2:3 composition. Blender/Cycles quality physically based 3D materials and rich depth, soft neutral key light with cyan-blue rim highlights. Isolated object on a GENUINELY TRANSPARENT background with real alpha, no opaque backdrop, no checkerboard painted into image. NO paper texture, ink splashes, scene, text, logo, UI, panels or border. Crisp silhouette to composite above a solid blue website background; do not tint or flatten the whole portrait blue.

### label

Use case: product-mockup. Asset: portrait 3:4 illustration for a packaging designer portfolio concept card. A beautifully composed flat vector label design sheet for a fictional premium citrus sparkling drink named LUMA. Bold condensed LUMA typography, orange and lemon cross sections, cream and vivid tangerine geometric shapes, dark forest green typography, delicate regulatory-style micro lines, precise print design, die-cut construction lines and tiny CMYK marks. One elegant centered rectangular label artwork with generous off-white margins, straight-on artboard view. High-end Illustrator packaging design aesthetic. No computer frame, no screenshot UI, no software logos, no hands, no person, no watermark. Label fills the image so it remains recognizable on a small card. Restrained crafted commercial graphic design, not a busy collage.

### retouch

Use case: product-mockup. Asset: portrait 3:4 commercial product photo for a Photoshop compositing portfolio card. A single premium slim matte orange aluminum sparkling beverage can labelled LUMA suspended at a diagonal in an energetic splash of clear water with orange slices and fine condensation droplets. Dark orange studio background, dramatic precise advertising light, shiny realistic droplets, high-end hyperreal photographic compositing, impeccable can geometry. Product fills most of frame, minimal bold typography on can, studio beverage advertising aesthetic. No software interface, no frame, no hands, no person, no watermark, no extra logos.

### booth

Use case: product-mockup. Asset: portrait 3:4 rendering for a product video and exhibition design portfolio concept card. Premium small exhibition trade-show booth for a fictional orange sparkling beverage brand LUMA. Eye-level three-quarter architectural 3D render: sculptural cream counter with bright orange fascia, a giant orange slim beverage can product display, a lit rectangular screen showing a can and citrus splash, orange overhead signage, product shelves and restrained fresh green details. Warm off-white convention hall floor, professional studio lighting, realistic high-end materials, visually clear product branding. No people, no watermarks, no software interface or frame. The booth and beverage are the focus, commercial design portfolio quality.

### androidCutout

Background extraction only. Keep this exact android portrait unchanged pixel-for-pixel: same man's face, pose, hair, materials and cyan lighting. REMOVE the white/gray CHECKERBOARD (it is an unwanted painted background in the input). Output a true transparent PNG with an ALPHA CHANNEL: background pixels alpha=0, subject pixels alpha=255 with antialiased edges. Do NOT DRAW a checkerboard, white background, gray background or any other replacement background. The deliverable is a genuine RGBA isolated cutout for web compositing. Keep full source dimensions and composition.

### androidRed

Use case identity-preserve style-transfer. Create a second cinematic 3D render based on this SAME android man, recognizably identical face and swept black hair, now as a software engineer / AI architect. Three-quarter waist-up portrait, slightly different confident pose, finely engineered obsidian black and brushed titanium body panels, small red emissive circuits and deep crimson rim lights instead of cyan. Human face stays naturally lit and recognizable, no mask. Portrait right-facing body with face looking toward viewer. Centered full head and shoulders, entire hair visible, vertical 2:3. Isolate on PURE SOLID BLACK #08090b backdrop, no painted checkerboard. NO floating windows or code or text baked into the image because real HTML floating code windows will be placed around him later. Premium physically based 3D rendering, detailed mechanical neck and shoulders, believable black chrome, not cartoon, not flat monochrome.

### matte

Use case: background-extraction MASK. This is an image editing task, NOT a new portrait. Output ONLY an exact segmentation matte for the supplied 1024x1536 image. KEEP pixel alignment and dimensions exactly 1024x1536. Paint every pixel belonging to the android subject (hair, face, neck, torso, arms, all human and mechanical body parts) PURE WHITE #FFFFFF, with no interior detail, no shading. Paint every background pixel (the current white-gray checkerboard) PURE BLACK #000000 including spaces between limbs. Preserve the exact subject silhouette, no shift, no resize, no pose change. Crisp lightly antialiased contour. The entire interior of the person must be solid white with no gray or black facial features. Deliver a plain white silhouette of this exact man on black, suitable as a CSS luminance mask. NO checkerboard. NO texture. NO text.

