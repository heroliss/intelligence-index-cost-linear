const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const sourceUrlFile = path.resolve(process.env.SOURCE_URL_FILE || 'source-url.txt');
let sourceUrl = process.env.SOURCE_URL;
if (!sourceUrl) {
  try { sourceUrl = fsSync.readFileSync(sourceUrlFile, 'utf8').trim(); } catch { sourceUrl = 'https://artificialanalysis.ai/'; }
}

async function getBuffer(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'intelligence-index-chart-updater/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function readManifest(pageHtml) {
  const matches = [...pageHtml.matchAll(/manifest\\":\{\\"path\\":\\"([^"\\]+)\\",\\"key\\":\\"([0-9a-f]+)\\"/gi)];
  if (!matches.length) throw new Error('Could not find Artificial Analysis data manifest in the page');
  const match = matches[matches.length - 1];
  return { path: match[1], key: match[2] };
}

function decryptPayload(encrypted, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.createHash('sha256').update(key).digest().subarray(0, 12);
  const tag = encrypted.subarray(-16);
  const ciphertext = encrypted.subarray(0, -16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return zlib.gunzipSync(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
}

function simplifyModel(model) {
  const cost = model.intelligenceIndexCostPerTask?.cost?.total;
  const score = model.intelligenceIndex;
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(score)) return null;
  return {
    id: model.id,
    slug: model.slug,
    name: model.name,
    shortName: model.shortName || model.name,
    intelligenceIndex: score,
    cost,
    creator: {
      name: model.creator?.name || 'Other',
      color: model.creator?.color || '#777777'
    },
    isReasoning: !!model.isReasoning,
    deprecated: !!model.deprecated
  };
}

async function main() {
  const page = (await getBuffer(sourceUrl)).toString('utf8');
  const manifest = readManifest(page);
  const manifestUrl = new URL(manifest.path, sourceUrl).href;
  const payload = JSON.parse(decryptPayload(await getBuffer(manifestUrl), manifest.key));
  const models = (payload.models || []).map(simplifyModel).filter(Boolean);
  if (models.length < 50) throw new Error(`Unexpectedly low model count: ${models.length}`);
  models.sort((a, b) => a.cost - b.cost || b.intelligenceIndex - a.intelligenceIndex);
  const output = {
    source: 'Artificial Analysis',
    sourceUrl,
    manifestPath: manifest.path,
    updatedAt: new Date().toISOString(),
    modelCount: models.length,
    models
  };
  const outPath = path.resolve(process.env.DATA_OUTPUT || 'data/current.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${models.length} models to ${outPath}`);
}

main().catch(error => { console.error(error.stack || error); process.exit(1); });
