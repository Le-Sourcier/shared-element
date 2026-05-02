# @le-sourcier/shared-element

A lightweight, dependency-free shared element transition library for React Native with Expo Router.

## Overview

`@le-sourcier/shared-element` enables smooth, seamless transitions between screens. When the user taps an element (a card, a button, an avatar), it visually transforms into the destination element on the next screen — creating the illusion that the element itself is expanding or moving.

Think iOS interactive transitions or Instagram media transitions, but pure JavaScript and Expo-Go-compatible.

## Features

- **Zero native dependencies** — pure JS, runs in Expo Go
- **Expo Router-native** — auto-keying based on `href` / `pathname`, no manual tag wiring
- **Cross-platform** — iOS and Android
- **Multiple presets** — `morph`, `fade`, `shape`, `push`
- **Multi-shared-element-safe** — many elements per tag, many tags per screen, no flicker on remount
- **Tiny** — ~5 KB minified

## Installation

```bash
npm install @le-sourcier/shared-element
```

### Prerequisites

- React Native 0.71+
- Expo SDK 50+
- `react-native-reanimated` 3.0+ (4.x recommended)

```bash
npm install react-native-reanimated
```

## Quick Start

### 1. Wrap your app with the Provider

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { SharedElementProvider } from '@le-sourcier/shared-element';

export default function RootLayout() {
  return (
    <SharedElementProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="details/[id]" options={{ animation: 'none' }} />
      </Stack>
    </SharedElementProvider>
  );
}
```

### 2. Wrap the source element

```tsx
// components/CardCarousel.tsx
import { SharedElement, useSharedElementNavigation } from '@le-sourcier/shared-element';

export function Card({ card }) {
  const navigate = useSharedElementNavigation();

  return (
    <SharedElement href={`/details/${card.id}`} borderRadius={28}>
      <Pressable onPress={() => navigate(`/details/${card.id}`)}>
        <CardVisual card={card} />
      </Pressable>
    </SharedElement>
  );
}
```

### 3. Wrap the destination element

```tsx
// app/details/[id].tsx
import { SharedElement, useSharedElementBack } from '@le-sourcier/shared-element';

export default function DetailsScreen() {
  const back = useSharedElementBack();

  return (
    <View>
      <SharedElement borderRadius={0}>
        <CardVisual card={card} compact />
      </SharedElement>
      <Pressable onPress={back}><Text>Close</Text></Pressable>
    </View>
  );
}
```

That's it. The auto-key matches `href` (source) with `pathname` (destination); no manual tag is required.

## API Reference

### Provider

#### `SharedElementProvider`

Hosts the registry and the overlay layer. Mount it once near the root of your app, above the navigator.

```tsx
<SharedElementProvider>
  {/* your app */}
</SharedElementProvider>
```

### Hooks

#### `useSharedElementNavigation()`

Returns a function that runs a forward shared-element transition and pushes the route.

```tsx
const navigate = useSharedElementNavigation();

await navigate('/details/1');

await navigate('/details/1', {
  preset: 'shape',
  config: { duration: 320 },
});
```

**Parameters:**

- `href` (`string` | `Href`) — destination URL.
- `opts?` (`object`)
  - `tag?` (`string`) — override the inferred tag.
  - `preset?` (`'morph' | 'fade' | 'shape' | 'push'`) — convenience shortcut for `config.preset`.
  - `config?` (`TransitionConfig`) — full configuration object.

#### `useSharedElementBack()`

Returns a function that runs a reverse transition and pops the stack. No arguments needed in 99 % of cases — the library remembers the most recent tag.

```tsx
const back = useSharedElementBack();
await back();
await back({ preset: 'shape' });
```

### Components

#### `SharedElement`

Wraps a participating element. The wrapper does not impose a layout (`flex: 1` etc.) — pass `style` to size it explicitly when its parent is a flex container.

```tsx
// Source — declares destination via href
<SharedElement href="/details/1" borderRadius={16}>
  <Pressable><Card /></Pressable>
</SharedElement>

// Destination — auto-keyed from pathname
<SharedElement borderRadius={0}>
  <Card />
</SharedElement>
```

**Props:**

- `id?` (`string`) — explicit shared-element key. Use this when neither auto-keying rule applies.
- `href?` (`string`) — destination URL (source side only).
- `borderRadius?` (`number`) — captured into the overlay clone and animated to the destination's `borderRadius`.
- `style?` (`StyleProp<ViewStyle>`) — applied to the wrapper view.
- `children` (`ReactNode`).

### Types

```ts
type Frame = { x: number; y: number; width: number; height: number };

type Snapshot = {
  id: string;
  frame: Frame;
  render: () => ReactNode;
  borderRadius?: number;
};

type TransitionPreset = 'morph' | 'fade' | 'shape' | 'push';

type TransitionConfig = {
  preset?: TransitionPreset;
  duration?: number;            // ms (used by `shape`, ignored by spring presets)
  damping?: number;             // spring damping
  stiffness?: number;           // spring stiffness
  mass?: number;                // spring mass
  crossfadeDuration?: number;   // crossfade ms (default tuned per preset)
};
```

## Transition Presets

| Preset  | Best for                                | Driver                                      |
| ------- | --------------------------------------- | ------------------------------------------- |
| `morph` | Card / hero image transitions           | Spring on x/y/w/h + timing crossfade        |
| `fade`  | Same-position elements (in-place swap)  | Pure crossfade                              |
| `shape` | Button → FAB, rectangle ↔ circle        | Linear interpolation, derives `r = min(w,h)/2` per frame so the silhouette stays a perfect stadium throughout |
| `push`  | Carousel item ↔ list row in same column | Spring biased toward translation over scale |

## How It Works

### Forward Transition

1. **Capture** — the source's frame is measured via `measureInWindow`.
2. **Show** — an overlay clone is mounted at the captured position; the source is hidden via the provider's hidden-tag store.
3. **Navigate** — `router.push` triggers the route change.
4. **Wait** — the library polls (up to 800 ms) for a registration with the same tag whose pathname differs from the source's.
5. **Animate** — the overlay morphs (spring or timing per preset) toward the destination frame, while the inner content crossfades.
6. **Hide** — the overlay unmounts; the destination becomes visible.

### Reverse Transition

1. **Pop** — the navigation stack returns the active tag.
2. **Capture / Show** — the destination's current frame is measured and overlaid.
3. **Back** — `router.back` triggers the pop.
4. **Wait + Animate + Hide** — same as forward, in reverse.

## Auto-Key Convention

Tags are inferred from props:

- **Source** (has `href`): `tag = href`.
- **Destination** (no `href`, no `id`): `tag = current pathname`, frozen at mount.
- **Auto** (`id` only): the tag is exactly `id`; the role is resolved by pathname comparison.

Pathnames are frozen at mount because expo-router keeps screens in the stack mounted across URL changes — without freezing, every `SharedElement` on every mounted screen would report the live URL, breaking destination resolution.

## Multi-Shared-Element Support

Many `SharedElement` instances can coexist on the same screen and even share the same tag (e.g. a header on screen A and the matching hero on screen B both auto-key to `/details/1`).

The provider keeps:

- a `Map<tag, Set<Registration>>` registry — every mounted element registers, all are reachable;
- a `Set<tag>` of currently-hidden tags driven by a **pub/sub** model.

Each `SharedElement` subscribes via `useSyncExternalStore`. When a transition hides or unhides a tag, every subscribed component re-reads the current value synchronously — including any component that mounts mid-transition. This eliminates the "element disappears" race that plagues naive setState-based registries when a screen is unmounted and remounted across a navigation push/pop.

### Multi-tag screens

A single screen may host any number of independently-keyed `SharedElement`s. The header (auto-keyed to its pathname) and a "Continue" button (`href` to a different route) coexist without interference because their tags are distinct. Tags are per-element, not per-screen.

### Tag overrides

When URLs don't match but you want to share elements:

```tsx
// Source — URL is "/details/1"
<SharedElement href="/details/1" id="apple"><Image /></SharedElement>

// Destination — URL is "/details/fruit-1"
<SharedElement id="apple"><Image /></SharedElement>
```

## Advanced Usage

### Custom spring

```tsx
await navigate('/details/1', {
  config: { damping: 30, stiffness: 200, mass: 0.8 },
});
```

### Shape preset (button ↔ circle)

```tsx
<SharedElement href="/details/card-2" borderRadius={16} style={{ height: 56 }}>
  <Pressable onPress={() => navigate('/details/card-2', { preset: 'shape' })}>
    <Text>Continue</Text>
  </Pressable>
</SharedElement>

// Destination
<SharedElement borderRadius={999} style={{ width: 80, height: 80 }}>
  <Pressable style={styles.circle}><Text>▶</Text></Pressable>
</SharedElement>
```

The `shape` preset interpolates linearly so the silhouette stays a perfect stadium (radius = `min(w,h)/2`) at every frame — no wobble, no two-phase seam.

### Sizing the wrapper

`SharedElement` does not apply a default `flex` or size. Pass `style` whenever the wrapper sits inside a flex container that doesn't dictate child size:

```tsx
<SharedElement style={{ flex: 1 }}>...</SharedElement>
<SharedElement style={{ width: 80, height: 80 }}>...</SharedElement>
```

This ensures `measureInWindow` returns the actual rendered frame rather than a collapsed or stretched wrapper.

## Integration with Expo Router

```tsx
// app/_layout.tsx
<Stack.Screen
  name="details/[id]"
  options={{ animation: 'none', gestureEnabled: false }}
/>
```

`animation: 'none'` lets the overlay take over visual continuity. The library handles its own animation; the navigator should stay out of the way.

## Troubleshooting

### Element not transitioning

1. **Tags match?** — source `href` (or `id`) must equal destination `pathname` (or `id`).
2. **Provider mounted?** — `SharedElementProvider` must wrap the navigator.
3. **Visible at mount?** — destinations rendered far below the fold (long ScrollView) may measure to off-screen coordinates. Place the destination above the fold or scroll it into view before navigation.

### Animation looks wrong

1. **borderRadius parity** — set `borderRadius` on both sides; the library animates from one to the other.
2. **Aspect ratio** — for `morph`, similar aspect ratios produce the smoothest result. Use `shape` when the aspect ratio changes drastically (rectangle → circle).

### Element disappears or flickers

1. **Wrapper has a layout?** — provide `style` so the wrapper has the same size as its child. A wrapper that collapses to 0×0 will fail to measure and produce a flicker.
2. **Multiple SharedElements share the same tag?** — that is supported; the most recently mounted one is captured. If you want a specific instance, use an explicit `id` and override on both sides.

### Navigation fails to find target

The library polls for 800 ms. For slow-mounting screens, consider lazy-loading or preloading the destination component.

## Comparison

| Feature         | @le-sourcier/shared-element | react-native-shared-element | Reanimated SET   |
| --------------- | --------------------------- | --------------------------- | ---------------- |
| Dependencies    | None                        | Native build                | React Navigation |
| Expo Go support | ✅                          | ❌                          | ❌               |
| Bundle size     | ~5 KB                       | ~50 KB                      | N/A              |
| Multi-element   | ✅ (pub/sub registry)       | Partial                     | Partial          |
| Maintenance     | Active                      | Abandoned                   | Experimental     |

## Credits

Built by [Le-Sourcier](https://github.com/Le-Sourcier).

- GitHub: [Le-Sourcier](https://github.com/Le-Sourcier)
- LinkedIn: [linkedin.com/in/yao-logan](https://linkedin.com/in/yao-logan)

## License

MIT.

## Changelog

### v1.1.0

- Pub/sub hidden-tag store via `useSyncExternalStore` — eliminates the "element disappears" race when a screen remounts mid-transition.
- Stable registrations: registry no longer churns on parent re-render.
- `shape` preset uses linear interpolation for a wobble-free stadium morph.
- Wrapper no longer imposes `flex: 1`; pass `style` explicitly.
- Multi-shared-element coexistence (multiple tags per screen, multiple registrations per tag) is now a documented, tested guarantee.

### v1.0.0

- Initial release.
- Forward and reverse transitions.
- Expo Router auto-key convention.
- Custom spring configuration.
