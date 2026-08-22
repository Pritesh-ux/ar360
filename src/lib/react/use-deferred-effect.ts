import { useEffect, type DependencyList, type EffectCallback } from "react";

/**
 * Like useEffect, but schedules the effect body on a microtask so state updates
 * do not run synchronously inside the effect (react-hooks/set-state-in-effect).
 */
export function useDeferredEffect(effect: EffectCallback, deps?: DependencyList): void {
  useEffect(() => {
    let active = true;
    let dispose: void | (() => void);

    queueMicrotask(() => {
      if (active) dispose = effect();
    });

    return () => {
      active = false;
      if (typeof dispose === "function") dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps);
}
