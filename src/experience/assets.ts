import { useGLTF } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { useMemo } from 'react';
import type { Texture, WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { shareTextures } from './materials/sharedTextures';

/** The models, all requested at once as soon as the canvas exists (loadAssets). */
export const MODELS = {
  room: '/models/room.glb',
  crt: '/models/crt.glb',
  spiral: '/models/spiral.glb',
  depths: '/models/depths.glb',
} as const;

/** The room's lightmaps, one per light source and atlas (blender/scripts/bake.py). */
export const ROOM_LIGHTMAPS = {
  aBase: '/models/room-lm-a-base.ktx2',
  aLamp: '/models/room-lm-a-lamp.ktx2',
  aScreen: '/models/room-lm-a-screen.ktx2',
  bBase: '/models/room-lm-b-base.ktx2',
  bLamp: '/models/room-lm-b-lamp.ktx2',
  bScreen: '/models/room-lm-b-screen.ktx2',
} as const;

/** The hanging CRT's baked AO, on its second UV set. */
export const CRT_AO = { ao: '/models/crt-ao.ktx2' } as const;

const DRACO = '/draco/';

/**
 * Every texture is KTX2 (blender/scripts/compress_textures.mjs). The transcoder, hosted with
 * the site like the Draco decoder, turns each into a compressed format this GPU takes, so it
 * stays compressed in video memory instead of costing four bytes a pixel.
 */
const ktx2 = new KTX2Loader().setTranscoderPath('/basis/');
let supportKnown = false;

type GltfLoader = Parameters<NonNullable<Parameters<typeof useGLTF>[3]>>[0];
const configured = new WeakSet<GltfLoader>();

function withKtx2(loader: GltfLoader) {
  if (configured.has(loader)) return;
  configured.add(loader);
  // drei's GLTFLoader comes from three-stdlib, whose types describe its own copy of this loader.
  loader.setKTX2Loader(ktx2 as unknown as Parameters<GltfLoader['setKTX2Loader']>[0]);
  // Once a model is built, its materials take the copies of textures other models already have.
  loader.register(() => ({ name: 'shared-textures', afterRoot: async ({ scene }) => shareTextures(scene) }));
}

/**
 * Tells the transcoder what this renderer supports, then requests every model and map at once
 * rather than one after another as each chapter suspends. Must run before anything loads.
 */
export function loadAssets(gl: WebGLRenderer): void {
  if (!supportKnown) {
    ktx2.detectSupport(gl);
    supportKnown = true;
  }
  for (const url of Object.values(MODELS)) useGLTF.preload(url, DRACO, false, withKtx2);
  useLoader.preload(ktx2, Object.values(ROOM_LIGHTMAPS));
  useLoader.preload(ktx2, Object.values(CRT_AO));
}

export const useModel = (url: string) => useGLTF(url, DRACO, false, withKtx2);

/** KTX2 maps by key, like drei's useTexture given an object. */
export function useKtx2<K extends string>(urls: Readonly<Record<K, string>>): Record<K, Texture> {
  const textures = useLoader(ktx2, Object.values<string>(urls)) as Texture[];
  return useMemo(() => {
    const keys = Object.keys(urls) as K[];
    return Object.fromEntries(keys.map((key, i) => [key, textures[i]])) as Record<K, Texture>;
  }, [urls, textures]);
}
