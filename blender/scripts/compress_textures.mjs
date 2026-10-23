// Turns every texture the Blender scripts export into KTX2 (Basis Universal), which the GPU
// keeps compressed: a sixth to an eighth of the memory of the decoded WebP, uploaded without
// decoding. It converts the images inside public/models/*.glb and the loose maps next to them.
// Images that are already KTX2 are left alone, so running it again only converts what is new.
//   npm run textures

import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { encodeToKTX2 } from 'ktx2-encoder';
import sharp from 'sharp';

const MODELS = path.resolve(import.meta.dirname, '../../public/models');

/**
 * How each kind of map is encoded. ETC1S keeps the files about as small as the WebP and lands
 * on the GPU at 4 bits per pixel. Baked light and AO are smooth gradients, where ETC1S would
 * show its blocks, so they get UASTC instead (8 bits per pixel, bigger files).
 */
const ETC1S = { isUASTC: false, qualityLevel: 255, compressionLevel: 2 };
const UASTC = { isUASTC: true, uastcLDRQualityLevel: 2 };
const KINDS = {
  color: { ...ETC1S, isPerceptual: true, isSetKTX2SRGBTransferFunc: true },
  data: { ...ETC1S, isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
  normal: { ...ETC1S, isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
  light: { ...UASTC, isPerceptual: true, isSetKTX2SRGBTransferFunc: true },
  shade: { ...UASTC, isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
};

/** Maps the web loads on their own rather than from a GLB: the room's lightmaps and the hanging CRT's AO. */
const LOOSE = [
  [/^room-lm-.+\.webp$/, 'light'],
  [/^crt-ao\.webp$/, 'shade'],
];

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function readGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error('not a GLB');
  let json = null;
  let bin = Buffer.alloc(0);
  for (let offset = 12; offset < buffer.length; ) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(data.toString('utf8'));
    if (type === BIN_CHUNK) bin = data;
    offset += 8 + length;
  }
  return { json, bin };
}

function writeGlb(json, bin) {
  const pad = (data, fill) => Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4, fill)]);
  const chunk = (data, type) => {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(data.length, 0);
    header.writeUInt32LE(type, 4);
    return Buffer.concat([header, data]);
  };
  const body = Buffer.concat([chunk(pad(Buffer.from(JSON.stringify(json)), 0x20), JSON_CHUNK), chunk(pad(bin, 0), BIN_CHUNK)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([header, body]);
}

/** Lays the binary chunk out again with some views' bytes swapped; every other view is copied as it was. */
function repack(json, bin, replaced) {
  const parts = [];
  let length = 0;
  json.bufferViews.forEach((view, index) => {
    if (view.buffer !== 0) return;
    const start = view.byteOffset ?? 0;
    const data = replaced.get(index) ?? bin.subarray(start, start + view.byteLength);
    const padding = (8 - (length % 8)) % 8;
    parts.push(Buffer.alloc(padding), data);
    view.byteOffset = length + padding;
    view.byteLength = data.length;
    length += padding + data.length;
  });
  json.buffers[0].byteLength = length;
  return Buffer.concat(parts);
}

/** The image a glTF texture shows, whichever format extension it comes through. */
const imageOf = (texture) => texture.source ?? texture.extensions?.EXT_texture_webp?.source ?? texture.extensions?.KHR_texture_basisu?.source;

/** What each image is used for, from the material slots that show it. */
function kindsOf(json) {
  const kinds = new Map();
  const mark = (slot, kind) => {
    if (!slot) return;
    const image = imageOf(json.textures[slot.index]);
    const known = kinds.get(image);
    if (known && known !== kind) throw new Error(`image ${json.images[image].name} is used as both ${known} and ${kind}`);
    kinds.set(image, kind);
  };
  for (const material of json.materials ?? []) {
    mark(material.pbrMetallicRoughness?.baseColorTexture, 'color');
    mark(material.emissiveTexture, 'color');
    mark(material.pbrMetallicRoughness?.metallicRoughnessTexture, 'data');
    mark(material.occlusionTexture, 'data');
    mark(material.normalTexture, 'normal');
  }
  return kinds;
}

async function decode(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

/** A 16 x 16 thumbnail, to tell whether two images with the same name show the same thing. */
const thumbnail = (buffer) => sharp(buffer).resize(16, 16, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
const looksSame = (a, b) => a.length === b.length && a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length < 4;

/**
 * Several models carry the same textures (the CRT's plastic is on the desk monitor, the
 * hanging ones and the sunken TVs). Each is encoded once and every copy gets the same bytes
 * and the same name, which is what the web's texture sharing goes by.
 */
const encoded = new Map();

async function encode(name, kind, source) {
  const thumb = await thumbnail(source);
  for (let copy = 1; ; copy++) {
    const key = `${copy === 1 ? name : `${name}~${copy}`}|${kind}`;
    const done = encoded.get(key);
    if (done && looksSame(done.thumb, thumb)) return done;
    if (done) continue;
    const started = performance.now();
    const bytes = Buffer.from(await encodeToKTX2(new Uint8Array(source), { ...KINDS[kind], generateMipmap: true, needSupercompression: true, imageDecoder: decode }));
    const result = { name: key.split('|')[0], bytes, thumb };
    encoded.set(key, result);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`  ${result.name} (${kind}): ${kb(source.length)} -> ${kb(bytes.length)}, ${seconds} s`);
    return result;
  }
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const rank = (file) => (FIRST.includes(file) ? FIRST.indexOf(file) : FIRST.length);

async function convertModel(file) {
  const { json, bin } = readGlb(await readFile(file));
  const kinds = kindsOf(json);
  const replaced = new Map();
  for (const [index, image] of (json.images ?? []).entries()) {
    const kind = kinds.get(index);
    if (image.mimeType === 'image/ktx2' || !kind) continue;
    const view = json.bufferViews[image.bufferView];
    const start = view.byteOffset ?? 0;
    const { name, bytes } = await encode(image.name ?? `image${index}`, kind, bin.subarray(start, start + view.byteLength));
    replaced.set(image.bufferView, bytes);
    image.name = name;
    image.mimeType = 'image/ktx2';
  }
  if (replaced.size === 0) return false;
  for (const texture of json.textures) {
    const image = imageOf(texture);
    if (json.images[image]?.mimeType !== 'image/ktx2') continue;
    const extensions = { ...texture.extensions, KHR_texture_basisu: { source: image } };
    delete extensions.EXT_texture_webp;
    delete texture.source;
    texture.extensions = extensions;
  }
  const webpLeft = json.textures.some((texture) => texture.extensions?.EXT_texture_webp);
  for (const list of ['extensionsUsed', 'extensionsRequired']) {
    const names = new Set(json[list] ?? []);
    if (!webpLeft) names.delete('EXT_texture_webp');
    names.add('KHR_texture_basisu');
    json[list] = [...names];
  }
  await writeFile(file, writeGlb(json, repack(json, bin, replaced)));
  return true;
}

/** Models whose copies of the shared textures were exported at the highest WebP quality go first. */
const FIRST = ['room.glb', 'crt.glb'];

async function main() {
  const files = (await readdir(MODELS)).sort();
  const models = files.filter((name) => name.endsWith('.glb')).sort((a, b) => rank(a) - rank(b));
  for (const file of models) {
    const full = path.join(MODELS, file);
    const before = (await readFile(full)).length;
    console.log(file);
    if (await convertModel(full)) console.log(`  ${file}: ${kb(before)} -> ${kb((await readFile(full)).length)}`);
    else console.log('  already KTX2');
  }
  for (const file of files) {
    const kind = LOOSE.find(([pattern]) => pattern.test(file))?.[1];
    if (!kind) continue;
    const full = path.join(MODELS, file);
    const { bytes } = await encode(path.parse(file).name, kind, await readFile(full));
    await writeFile(full.replace(/\.webp$/, '.ktx2'), bytes);
    await rm(full);
  }
}

await main();
