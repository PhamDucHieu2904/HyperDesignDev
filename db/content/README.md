# Authored portfolio content

Vinut Corporate Uniform is the first Visual entry. Its seven supplied artboards
appear in their original numbered order, followed by an editable “Thank you for
watching” footer. The supplied square thumbnail fills its card.

- `app/portfolio/content/uniform.json`: seven image blocks and two closing blocks.
- `app/portfolio/content/uniform-media.json`: eight asset descriptors.
- `public/portfolio/uniform/`: original WebP artwork and thumbnail.

Prepare or import the uniform collection with `npm run content:uniform:prepare`
or `npm run content:uniform:local`. The latter backs up and adds content to both
local D1/R2 stores; replays preserve later edits and unpublished status. It uses
the same local-only importer as Quencha and leaves existing content intact.
No remote deployment is performed.

Quencha Beverage is the first Brand entry in the local portfolio registry. Its
presentation follows the supplied template using the eight original WebP artworks
and the supplied watermelon thumbnail. Images retain their original bytes and
aspect ratios; introduction and closing copy remain editable text blocks.

Canonical source:

- `app/portfolio/content/quencha.json`: the 14 article blocks.
- `app/portfolio/content/quencha-media.json`: the nine asset descriptors.
- `public/portfolio/quencha/`: the original images copied into the repository.
- `app/portfolio/quencha.css`: the continuous white artboard shared by public and admin preview.

The generated `quencha-beverage.json` and `.sql` files are prepared by:

```powershell
npm run content:quencha:prepare
```

To import Quencha into both existing local D1/R2 stores:

```powershell
npm run content:quencha:local
```

The importer only accepts local operation. It backs up the SQLite databases into
the Git-ignored `.tmp/admin-integration/quencha/` directory, uploads nine immutable
media objects into each local R2 store and adds Quencha's draft, first revision,
public projection and asset references. Replaying the import does not overwrite
later admin edits or republish an unpublished project. Existing projects and
media remain untouched.

The legacy six-project database seed stays unchanged. Authored JSON documents
such as Quencha and Label Lab are excluded from the legacy section-to-block seed
generator, so it cannot replace a prepared article with an empty body.

The static website and both Cloudflare build outputs include Quencha's files.
These commands do not publish a website or change remote D1/R2. The current import
has been applied to `.wrangler/state/` and `.wrangler/admin/state/` only.

Original artwork mapping:

| Supplied file | Repository asset |
| --- | --- |
| Poster-resized.webp | hero.webp |
| Banner1-resized.webp | banner.webp, used twice |
| Label-resized.webp | labels.webp |
| Cataloge page 1-resized.webp | mango-catalogue.webp |
| Poster2-resized.webp | cans.webp |
| Poster1-resized.webp | watermelon-poster.webp |
| Banner2-resized.webp | storefront.webp |
| Mockup-resized.webp | brand-mockups.webp |
| Thumbnail.webp | thumbnail.webp |
