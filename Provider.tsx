import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import type { Frame, Snapshot, TransitionConfig, TransitionPreset } from './types';

export type Registration = {
  id: string;
  /** Pathname of the screen this element lives on. */
  pathname: string;
  /** 'source' = points TO another route (href set). 'destination' = lives at
   * its own route (auto-keyed from pathname). 'auto' = explicit id. */
  role: 'source' | 'destination' | 'auto';
  measure: () => Promise<Frame | null>;
  render: () => ReactNode;
  borderRadius?: number;
};

type ActiveTransition = {
  id: string;
  fromRender: () => ReactNode;
  toRender: (() => ReactNode) | null;
  toBorderRadius: number | null;
};

type CaptureResult = {
  snapshot: Snapshot;
  registration: Registration;
};

type AnimateArgs = {
  to: Frame;
  toRender: () => ReactNode;
  toBorderRadius?: number;
  config?: TransitionConfig;
};

type Listener = () => void;

type Ctx = {
  register: (r: Registration) => () => void;
  capture: (id: string) => Promise<CaptureResult | null>;
  showOverlay: (id: string, snapshot: Snapshot) => void;
  animateOverlay: (args: AnimateArgs) => Promise<void>;
  hideOverlay: () => void;
  /** True iff a transition currently owns this tag (overlay covers it). */
  isHidden: (id: string) => boolean;
  /** Subscribe to hidden-state changes for this tag. Returns unsubscribe. */
  subscribeHidden: (id: string, listener: Listener) => () => void;
  getRegistrations: (id: string) => Registration[];
  pushNavTag: (tag: string) => void;
  popNavTag: () => string | null;
  peekNavTag: () => string | null;
};

const SharedElementContext = createContext<Ctx | null>(null);

export function useSharedElementContext() {
  const ctx = useContext(SharedElementContext);
  if (!ctx) {
    throw new Error(
      'SharedElement components must be rendered inside <SharedElementProvider>',
    );
  }
  return ctx;
}

const DEFAULT_SPRING = { damping: 22, stiffness: 180, mass: 0.9 };

const PRESET_DEFAULTS: Record<
  TransitionPreset,
  { spring: typeof DEFAULT_SPRING; crossfade: number }
> = {
  morph: { spring: { damping: 22, stiffness: 180, mass: 0.9 }, crossfade: 260 },
  fade: { spring: { damping: 30, stiffness: 260, mass: 0.7 }, crossfade: 220 },
  shape: { spring: { damping: 26, stiffness: 200, mass: 0.9 }, crossfade: 220 },
  push: { spring: { damping: 26, stiffness: 220, mass: 0.85 }, crossfade: 180 },
};

export function SharedElementProvider({ children }: { children: ReactNode }) {
  // Multi-instance registry: many SharedElements can share the same tag
  // (a button on /a pointing to /b, plus a hero on /b — both register under
  //  the same key). Insertion order is preserved, so capture() picks the
  // most recently-mounted one (typically the just-arrived screen).
  const registry = useRef(new Map<string, Set<Registration>>());

  // Hidden-state is driven by a per-tag listener pattern instead of a stale
  // Set of IDs broadcast through cached setState callbacks. Every
  // SharedElement subscribes via subscribeHidden() and reads isHidden() on
  // every notification — so a remount in the middle of a transition picks
  // up the *current* state on its first paint, with no race window.
  const hiddenTags = useRef(new Set<string>());
  const listeners = useRef(new Map<string, Set<Listener>>());

  const [active, setActive] = useState<ActiveTransition | null>(null);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const radius = useSharedValue(0);
  const progress = useSharedValue(0);
  const stadiumMode = useSharedValue(0);
  const shapeT = useSharedValue(0);
  const shapeFromX = useSharedValue(0);
  const shapeFromY = useSharedValue(0);
  const shapeFromW = useSharedValue(0);
  const shapeFromH = useSharedValue(0);
  const shapeToX = useSharedValue(0);
  const shapeToY = useSharedValue(0);
  const shapeToW = useSharedValue(0);
  const shapeToH = useSharedValue(0);

  const notifyHidden = useCallback((id: string) => {
    const set = listeners.current.get(id);
    if (!set) return;
    // Snapshot to a stable array so a listener that unsubscribes during
    // notification doesn't mutate the iteration target.
    Array.from(set).forEach((listener) => listener());
  }, []);

  const register = useCallback((reg: Registration) => {
    let set = registry.current.get(reg.id);
    if (!set) {
      set = new Set();
      registry.current.set(reg.id, set);
    }
    set.add(reg);
    return () => {
      const s = registry.current.get(reg.id);
      if (!s) return;
      s.delete(reg);
      if (s.size === 0) registry.current.delete(reg.id);
    };
  }, []);

  const getRegistrations = useCallback((id: string) => {
    const set = registry.current.get(id);
    if (!set) return [];
    return Array.from(set);
  }, []);

  const isHidden = useCallback(
    (id: string) => hiddenTags.current.has(id),
    [],
  );

  const subscribeHidden = useCallback(
    (id: string, listener: Listener) => {
      let set = listeners.current.get(id);
      if (!set) {
        set = new Set();
        listeners.current.set(id, set);
      }
      set.add(listener);
      return () => {
        const s = listeners.current.get(id);
        if (!s) return;
        s.delete(listener);
        if (s.size === 0) listeners.current.delete(id);
      };
    },
    [],
  );

  const setHidden = useCallback(
    (id: string, hidden: boolean) => {
      const wasHidden = hiddenTags.current.has(id);
      if (hidden === wasHidden) return;
      if (hidden) hiddenTags.current.add(id);
      else hiddenTags.current.delete(id);
      notifyHidden(id);
    },
    [notifyHidden],
  );

  const capture = useCallback(
    async (id: string): Promise<CaptureResult | null> => {
      const set = registry.current.get(id);
      if (!set || set.size === 0) return null;
      // Iterate in insertion order; pick the last (most recently mounted).
      let latest: Registration | undefined;
      set.forEach((r) => {
        latest = r;
      });
      if (!latest) return null;
      const frame = await latest.measure();
      if (!frame) return null;
      return {
        snapshot: {
          id,
          frame,
          render: latest.render,
          borderRadius: latest.borderRadius,
        },
        registration: latest,
      };
    },
    [],
  );

  const activeIdRef = useRef<string | null>(null);

  const showOverlay = useCallback(
    (id: string, snapshot: Snapshot) => {
      x.value = snapshot.frame.x;
      y.value = snapshot.frame.y;
      w.value = snapshot.frame.width;
      h.value = snapshot.frame.height;
      radius.value = snapshot.borderRadius ?? 0;
      progress.value = 0;
      stadiumMode.value = 0;
      activeIdRef.current = id;
      setActive({
        id,
        fromRender: snapshot.render,
        toRender: null,
        toBorderRadius: null,
      });
      setHidden(id, true);
    },
    [progress, radius, setHidden, stadiumMode, w, x, y, h],
  );

  const animateOverlay = useCallback(
    ({ to, toRender, toBorderRadius, config }: AnimateArgs): Promise<void> => {
      setActive((prev) =>
        prev
          ? {
              ...prev,
              toRender,
              toBorderRadius: toBorderRadius ?? prev.toBorderRadius,
            }
          : prev,
      );

      const preset: TransitionPreset = config?.preset ?? 'morph';
      const presetCfg = PRESET_DEFAULTS[preset];
      const spring = {
        damping: config?.damping ?? presetCfg.spring.damping,
        stiffness: config?.stiffness ?? presetCfg.spring.stiffness,
        mass: config?.mass ?? presetCfg.spring.mass,
      };
      const crossfadeMs = config?.crossfadeDuration ?? presetCfg.crossfade;
      stadiumMode.value = preset === 'shape' ? 1 : 0;

      return new Promise<void>((resolve) => {
        const onDone = () => resolve();

        if (preset === 'shape') {
          shapeFromX.value = x.value;
          shapeFromY.value = y.value;
          shapeFromW.value = w.value;
          shapeFromH.value = h.value;
          shapeToX.value = to.x;
          shapeToY.value = to.y;
          shapeToW.value = to.width;
          shapeToH.value = to.height;
          shapeT.value = 0;

          const totalMs = config?.duration ?? 320;
          shapeT.value = withTiming(
            1,
            { duration: totalMs, easing: Easing.bezier(0.4, 0, 0.2, 1) },
            (finished) => {
              'worklet';
              if (finished) runOnJS(onDone)();
            },
          );
          progress.value = withTiming(1, {
            duration: totalMs,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
          });
        } else {
          x.value = withSpring(to.x, spring);
          y.value = withSpring(to.y, spring);
          w.value = withSpring(to.width, spring);
          h.value = withSpring(to.height, spring, (finished) => {
            'worklet';
            if (finished) runOnJS(onDone)();
          });
          if (toBorderRadius != null) {
            radius.value = withTiming(toBorderRadius, { duration: crossfadeMs });
          }
          progress.value = withTiming(1, { duration: crossfadeMs });
        }
      });
    },
    [
      progress,
      radius,
      stadiumMode,
      shapeFromH,
      shapeFromW,
      shapeFromX,
      shapeFromY,
      shapeT,
      shapeToH,
      shapeToW,
      shapeToX,
      shapeToY,
      w,
      x,
      y,
      h,
    ],
  );

  const hideOverlay = useCallback(() => {
    const id = activeIdRef.current;
    if (id) setHidden(id, false);
    activeIdRef.current = null;
    stadiumMode.value = 0;
    setActive(null);
  }, [setHidden, stadiumMode]);

  const navStack = useRef<string[]>([]);
  const pushNavTag = useCallback((tag: string) => {
    navStack.current.push(tag);
  }, []);
  const popNavTag = useCallback((): string | null => {
    return navStack.current.pop() ?? null;
  }, []);
  const peekNavTag = useCallback((): string | null => {
    const s = navStack.current;
    return s.length > 0 ? s[s.length - 1] : null;
  }, []);

  const ctx = useMemo<Ctx>(
    () => ({
      register,
      capture,
      showOverlay,
      animateOverlay,
      hideOverlay,
      isHidden,
      subscribeHidden,
      getRegistrations,
      pushNavTag,
      popNavTag,
      peekNavTag,
    }),
    [
      register,
      capture,
      showOverlay,
      animateOverlay,
      hideOverlay,
      isHidden,
      subscribeHidden,
      getRegistrations,
      pushNavTag,
      popNavTag,
      peekNavTag,
    ],
  );

  const overlayContainerStyle = useAnimatedStyle(() => {
    'worklet';
    if (stadiumMode.value === 1) {
      const t = shapeT.value;
      const cxFrom = shapeFromX.value + shapeFromW.value / 2;
      const cyFrom = shapeFromY.value + shapeFromH.value / 2;
      const cxTo = shapeToX.value + shapeToW.value / 2;
      const cyTo = shapeToY.value + shapeToH.value / 2;
      const cx = cxFrom + (cxTo - cxFrom) * t;
      const cy = cyFrom + (cyTo - cyFrom) * t;
      const width =
        shapeFromW.value + (shapeToW.value - shapeFromW.value) * t;
      const height =
        shapeFromH.value + (shapeToH.value - shapeFromH.value) * t;
      const r = Math.min(width, height) / 2;
      return {
        position: 'absolute',
        left: cx - width / 2,
        top: cy - height / 2,
        width,
        height,
        borderRadius: r,
        overflow: 'hidden',
      };
    }
    return {
      position: 'absolute',
      left: x.value,
      top: y.value,
      width: w.value,
      height: h.value,
      borderRadius: radius.value,
      overflow: 'hidden',
    };
  });

  const fromStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const toStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <SharedElementContext.Provider value={ctx}>
      <View style={styles.root}>
        {children}
        {active ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View style={overlayContainerStyle}>
              <Animated.View style={[StyleSheet.absoluteFill, fromStyle]}>
                {active.fromRender()}
              </Animated.View>
              {active.toRender ? (
                <Animated.View style={[StyleSheet.absoluteFill, toStyle]}>
                  {active.toRender()}
                </Animated.View>
              ) : null}
            </Animated.View>
          </View>
        ) : null}
      </View>
    </SharedElementContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
