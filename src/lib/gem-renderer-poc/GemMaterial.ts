/**
 * GemMaterial — parameter façade over GemDiamondShader uniforms.
 */
import type { ShaderMaterial } from "three";
import {
  createGemDiamondMaterial,
  type GemShaderUniforms,
} from "./GemDiamondShader";
import type { GemPocParams } from "./types";
import { REFERENCE_DIAMOND_PARAMS, dispersionModeLabel } from "./types";

export class GemMaterial {
  readonly shader: GemShaderUniforms;
  private params: GemPocParams = {
    ...REFERENCE_DIAMOND_PARAMS,
    absorption: [...REFERENCE_DIAMOND_PARAMS.absorption] as [
      number,
      number,
      number,
    ],
  };

  constructor() {
    this.shader = createGemDiamondMaterial();
  }

  get threeMaterial(): ShaderMaterial {
    return this.shader.material;
  }

  get currentParams(): GemPocParams {
    return {
      ...this.params,
      absorption: [...this.params.absorption] as [number, number, number],
    };
  }

  setParams(partial: Partial<GemPocParams> | GemPocParams) {
    this.params = {
      ...this.params,
      ...partial,
      absorption: partial.absorption
        ? ([...partial.absorption] as [number, number, number])
        : this.params.absorption,
    };
    this.shader.applyParams(this.params);
  }

  getDispersionMode() {
    return dispersionModeLabel(this.params);
  }

  dispose() {
    this.shader.dispose();
  }
}
