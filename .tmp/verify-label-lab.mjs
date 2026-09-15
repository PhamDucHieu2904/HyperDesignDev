import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const base = "https://hyperd-public-staging.hieu-caelestia-portfolio.workers.dev";
const content = JSON.parse(await readFile(new URL("./label-lab-content.json", import.meta.url), "utf8"));
const sources = new Map([
  ["label-lab-app-icon", "D:/UnityHubData/Unity_3D_Mockup_Project/Assets/System/UI sprite/Icon/1024.png"],
  ["label-lab-wordmark", "D:/UnityHubData/Unity_3D_Mockup_Project/Assets/System/UI sprite/LogoLL2.png"],
  ["label-lab-package-1500", "D:/UnityHubData/Unity_3D_Mockup_Project/Assets/Data/Packing look up/Thumbnail/Thumb_Label_1500_Bottle_1.png"],
  ["label-lab-package-500-short", "D:/UnityHubData/Unity_3D_Mockup_Project/Assets/Data/Packing look up/Thumbnail/Thumb_Label_500_Bottle_1.png"],
  ["label-lab-package-500-long", "D:/UnityHubData/Unity_3D_Mockup_Project/Assets/Data/Packing look up/Thumbnail/Thumb_Label_500_Bottle_2.png"]
]);

const listResponse = await fetch(`${base}/api/v1/projects?q=label%20lab&limit=48`);
assert.equal(listResponse.status, 200);
const list = await listResponse.json();
assert.equal(list.items.filter(item => item.id === content.id).length, 1, "Label Lab must appear exactly once in the public index.");

const detailResponse = await fetch(`${base}/api/v1/projects/${content.id}`);
assert.equal(detailResponse.status, 200);
const detail = await detailResponse.json();
assert.equal(detail.categoryId, "app");
assert.equal(detail.title, content.metadata.title);
assert.equal(detail.shortTitle, content.metadata.shortTitle);
assert.equal(detail.subtitle, content.metadata.subtitle);
assert.deepEqual(detail.document, content.document);
assert.equal(detail.contentState, "ready");
assert.equal(detail.media.length, sources.size);

for (const media of detail.media) {
  const sourcePath = sources.get(media.id);
  assert.ok(sourcePath, `Unexpected media ${media.id}.`);
  const [local, remoteResponse] = await Promise.all([readFile(sourcePath), fetch(`${base}${media.url}`)]);
  assert.equal(remoteResponse.status, 200, `${media.id} must be public.`);
  const remote = Buffer.from(await remoteResponse.arrayBuffer());
  assert.equal(remote.byteLength, local.byteLength, `${media.id} byte length must match.`);
  assert.equal(createHash("sha256").update(remote).digest("hex"), createHash("sha256").update(local).digest("hex"), `${media.id} checksum must match.`);
}

console.log(`Verified published Label Lab: ${content.document.blocks.length} top-level blocks and ${detail.media.length} byte-identical media assets.`);
