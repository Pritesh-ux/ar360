/**
 * GemEnvironment — HDRI load for equirect sampling in the gem shader.
 * Implements GemEnvironmentContract for future AR360 HDRI bridge (POC V5).
 */
import {
  EquirectangularReflectionMapping,
  LinearFilter,
  LinearSRGBColorSpace,
  type DataTexture,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import type {
  Ar360EnvironmentSource,
  GemEnvironmentContract,
} from "./gemHdriContract";

export type GemEnvironmentHandle = {
  envMap: Texture;
  url: string;
};

export class GemEnvironment implements GemEnvironmentContract {
  private current: GemEnvironmentHandle | null = null;
  private intensity = 1;
  private rotation = 0;
  private onParams?: (p: {
    environmentIntensity: number;
    environmentRotation: number;
    exposure?: number;
  }) => void;

  constructor(
    _renderer: WebGLRenderer,
    onParams?: (p: {
      environmentIntensity: number;
      environmentRotation: number;
      exposure?: number;
    }) => void,
  ) {
    void _renderer;
    this.onParams = onParams;
  }

  get handle() {
    return this.current;
  }

  getCurrentUrl(): string | null {
    return this.current?.url ?? null;
  }

  setIntensity(intensity: number) {
    this.intensity = intensity;
    this.onParams?.({
      environmentIntensity: this.intensity,
      environmentRotation: this.rotation,
    });
  }

  setRotation(radians: number) {
    this.rotation = radians;
    this.onParams?.({
      environmentIntensity: this.intensity,
      environmentRotation: this.rotation,
    });
  }

  async applyFromAr360(source: Ar360EnvironmentSource): Promise<void> {
    await this.load(source.url);
    this.intensity = source.intensity;
    this.rotation = source.rotationRadians;
    this.onParams?.({
      environmentIntensity: source.intensity,
      environmentRotation: source.rotationRadians,
      exposure: source.exposure,
    });
  }

  async load(url: string): Promise<GemEnvironmentHandle> {
    const loader = new RGBELoader();
    const raw = (await loader.loadAsync(url)) as DataTexture;
    raw.mapping = EquirectangularReflectionMapping;
    raw.colorSpace = LinearSRGBColorSpace;
    raw.minFilter = LinearFilter;
    raw.magFilter = LinearFilter;
    raw.needsUpdate = true;

    this.disposeCurrent();
    this.current = { envMap: raw, url };
    return this.current;
  }

  disposeCurrent() {
    if (this.current) {
      this.current.envMap.dispose();
      this.current = null;
    }
  }

  dispose() {
    this.disposeCurrent();
  }
}
