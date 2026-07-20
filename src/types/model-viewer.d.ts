import type React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        poster?: string;
        ar?: boolean;
        "ar-modes"?: string;
        exposure?: string;
        "environment-image"?: string;
        "shadow-intensity"?: string;
        "shadow-softness"?: string;
        "field-of-view"?: string;
        "camera-orbit"?: string;
        "camera-target"?: string;
        "skybox-image"?: string;
        "interaction-prompt"?: string;
        "auto-rotate"?: boolean;
        "camera-controls"?: boolean;
        "disable-zoom"?: boolean;
        autoplay?: boolean;
        "ios-src"?: string;
        "ar-scale"?: string;
        "ar-placement"?: "floor" | "wall";
        "loading"?: string;
        "reveal"?: string;
        "touch-action"?: string;
      };
    }
  }
}

export {};
