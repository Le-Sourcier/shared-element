import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { useSharedElementContext } from './Provider';
import type { Frame } from './types';

type Props = {
  /** Pass `id` to opt out of the auto-key convention. On the source side,
   * `href` is used as the key. On the destination side, omit both and the
   * pathname becomes the key automatically. */
  id?: string;
  href?: string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function SharedElement({
  id,
  href,
  borderRadius,
  style,
  children,
}: Props) {
  const ctx = useSharedElementContext();
  const livePathname = usePathname();
  // Frozen at mount: prevents stale screens that are still in the stack from
  // reporting the live URL on every navigation re-render.
  const [pathname] = useState(livePathname);
  const tag = id ?? href ?? pathname;

  const ref = useRef<View>(null);

  // Live refs — updated every render but never trigger re-registration.
  const childrenRef = useRef(children);
  const borderRadiusRef = useRef(borderRadius);
  childrenRef.current = children;
  borderRadiusRef.current = borderRadius;

  // Hidden state: subscribed to the provider's per-tag store. Re-reads on
  // every notification, so a remount mid-transition picks up the current
  // value on its first paint without a race window.
  const subscribe = useCallback(
    (listener: () => void) => ctx.subscribeHidden(tag, listener),
    [ctx, tag],
  );
  const getSnapshot = useCallback(() => ctx.isHidden(tag), [ctx, tag]);
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const role: 'source' | 'destination' | 'auto' = href
    ? 'source'
    : id
      ? 'auto'
      : 'destination';

  // Stable measure: reads ref.current at call time.
  const measure = useCallback((): Promise<Frame | null> => {
    return new Promise((resolve) => {
      const node = ref.current;
      if (!node) {
        resolve(null);
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        if (
          width === 0 ||
          height === 0 ||
          Number.isNaN(x) ||
          Number.isNaN(y)
        ) {
          resolve(null);
          return;
        }
        resolve({ x, y, width, height });
      });
    });
  }, []);

  // Stable render: always renders the *current* children via ref.
  const renderClone = useCallback((): ReactNode => {
    return <View style={styles.clone}>{childrenRef.current}</View>;
  }, []);

  // Register ONCE per tag/pathname/role. Mutable bits (children,
  // borderRadius) flow through refs; register/unregister churn on every
  // render is what was making elements briefly disappear from the registry.
  useEffect(() => {
    const unsub = ctx.register({
      id: tag,
      pathname,
      role,
      measure,
      render: renderClone,
      get borderRadius() {
        return borderRadiusRef.current;
      },
    } as Parameters<typeof ctx.register>[0]);
    return unsub;
  }, [ctx, tag, pathname, role, measure, renderClone]);

  const wrapperStyle = useMemo(
    () => [style, { opacity: hidden ? 0 : 1 }] as StyleProp<ViewStyle>,
    [style, hidden],
  );

  return (
    <View ref={ref} collapsable={false} style={wrapperStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clone: { width: '100%', height: '100%' },
});
