import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useSharedElementContext, type Registration } from './Provider';
import type { Frame, TransitionConfig, TransitionPreset } from './types';

const MAX_WAIT_MS = 800;
const POLL_MS = 16;

type Target = {
  frame: Frame;
  registration: Registration;
};

/**
 * Find a registration that represents the *other side* of a transition.
 *
 * `sourcePathname` is the pathname the user is leaving (forward) or going
 * back to (reverse, where the source is what we want as target).
 *
 * For forward nav: we want a registration whose pathname is NOT
 * `sourcePathname` — that's the destination screen that just mounted.
 *
 * For back nav: we want a registration whose pathname IS the route we're
 * popping back to — the original source.
 *
 * In both cases, prefer 'destination' role (auto-keyed = lives on its own
 * route) over 'source' role (which is just a launch button). This breaks
 * ties when the same tag is registered by both a button on screen A and a
 * hero on screen B.
 */
async function waitForTarget(
  ctx: ReturnType<typeof useSharedElementContext>,
  id: string,
  excluded: Registration,
  predicate: (reg: Registration) => boolean,
): Promise<Target | null> {
  const deadline = Date.now() + MAX_WAIT_MS;
  return new Promise((resolve) => {
    const tick = async () => {
      const all = ctx
        .getRegistrations(id)
        .filter((r) => r !== excluded && predicate(r));
      // Prefer destinations over sources when both match.
      const ranked = [...all].sort((a, b) => {
        const score = (r: Registration) =>
          r.role === 'destination' ? 0 : r.role === 'auto' ? 1 : 2;
        return score(a) - score(b);
      });
      for (const reg of ranked) {
        const frame = await reg.measure();
        if (frame) {
          resolve({ frame, registration: reg });
          return;
        }
      }
      if (Date.now() > deadline) {
        resolve(null);
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
  });
}

/**
 * `navigate(href)` runs a shared-element transition keyed on `href`. Source
 * <SharedElement href={...}> registers under that key; destination
 * <SharedElement> picks up the same key from its own pathname.
 *
 * Pass `opts.tag` to override the inferred tag, `opts.config` to customize
 * the spring/preset.
 */
export function useSharedElementNavigation() {
  const ctx = useSharedElementContext();
  const router = useRouter();

  return useCallback(
    async (
      href: Href,
      opts?: {
        tag?: string;
        preset?: TransitionPreset;
        config?: TransitionConfig;
      },
    ) => {
      const tag =
        opts?.tag ?? (typeof href === 'string' ? href : String(href));
      // `preset` is a top-level shortcut so callers don't need to write
      // `{ config: { preset: 'shape' } }` for the common case.
      const config: TransitionConfig | undefined =
        opts?.preset
          ? { preset: opts.preset, ...opts.config }
          : opts?.config;

      const captured = await ctx.capture(tag);
      if (!captured) {
        router.push(href);
        return;
      }

      const sourcePathname = captured.registration.pathname;
      ctx.showOverlay(tag, captured.snapshot);
      ctx.pushNavTag(tag);
      router.push(href);

      // Forward: target is whichever element with this tag lives on a
      // different pathname than the source.
      const target = await waitForTarget(
        ctx,
        tag,
        captured.registration,
        (r) => r.pathname !== sourcePathname,
      );

      if (!target) {
        ctx.hideOverlay();
        return;
      }

      await ctx.animateOverlay({
        to: target.frame,
        toRender: target.registration.render,
        toBorderRadius: target.registration.borderRadius,
        config,
      });
      ctx.hideOverlay();
    },
    [ctx, router],
  );
}

/**
 * `back()` pops the last shared-element navigation tag and runs the reverse
 * transition. No arguments needed in 99% of cases.
 */
export function useSharedElementBack() {
  const ctx = useSharedElementContext();
  const router = useRouter();

  return useCallback(
    async (opts?: {
      tag?: string;
      preset?: TransitionPreset;
      config?: TransitionConfig;
    }) => {
      const tag = opts?.tag ?? ctx.popNavTag();
      const config: TransitionConfig | undefined =
        opts?.preset
          ? { preset: opts.preset, ...opts.config }
          : opts?.config;

      if (!tag) {
        router.back();
        return;
      }

      const captured = await ctx.capture(tag);
      if (!captured) {
        router.back();
        return;
      }

      const destPathname = captured.registration.pathname;
      ctx.showOverlay(tag, captured.snapshot);
      router.back();

      // Reverse: target is whichever element with this tag lives on a
      // different pathname than what we just left (the destination).
      const target = await waitForTarget(
        ctx,
        tag,
        captured.registration,
        (r) => r.pathname !== destPathname,
      );

      if (!target) {
        ctx.hideOverlay();
        return;
      }

      await ctx.animateOverlay({
        to: target.frame,
        toRender: target.registration.render,
        toBorderRadius: target.registration.borderRadius,
        config,
      });
      ctx.hideOverlay();
    },
    [ctx, router],
  );
}
