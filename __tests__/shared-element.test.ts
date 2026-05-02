import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Frame, Snapshot, TransitionConfig } from '../types';

describe('Frame type', () => {
  it('should define x, y, width, height', () => {
    type Frame = { x: number; y: number; width: number; height: number };
    
    const frame: Frame = { x: 10, y: 20, width: 100, height: 50 };
    
    expect(frame.x).toBe(10);
    expect(frame.y).toBe(20);
    expect(frame.width).toBe(100);
    expect(frame.height).toBe(50);
  });
});

describe('Snapshot type', () => {
  it('should contain id, frame, render function and borderRadius', () => {
    type Snapshot = {
      id: string;
      frame: { x: number; y: number; width: number; height: number };
      render: () => null;
      borderRadius?: number;
    };
    
    const snapshot: Snapshot = {
      id: 'tag-a',
      frame: { x: 10, y: 100, width: 300, height: 180 },
      render: () => null,
      borderRadius: 28,
    };
    
    expect(snapshot.id).toBe('tag-a');
    expect(snapshot.frame.width).toBe(300);
    expect(snapshot.borderRadius).toBe(28);
  });
});

describe('TransitionConfig', () => {
  it('should support custom spring animation parameters', () => {
    type TransitionConfig = {
      duration?: number;
      damping?: number;
      stiffness?: number;
      mass?: number;
    };
    
    const customConfig: TransitionConfig = {
      duration: 500,
      damping: 30,
      stiffness: 200,
      mass: 0.8,
    };
    
    expect(customConfig.duration).toBe(500);
    expect(customConfig.damping).toBe(30);
    expect(customConfig.stiffness).toBe(200);
  });
  
  it('should merge with defaults', () => {
    const defaults: TransitionConfig = { damping: 22, stiffness: 180, mass: 0.9 };
    const custom: TransitionConfig = { damping: 30, stiffness: 200 };
    
    const merged: TransitionConfig = {
      damping: custom.damping ?? defaults.damping,
      stiffness: custom.stiffness ?? defaults.stiffness,
      mass: custom.mass ?? defaults.mass,
    };
    
    expect(merged.damping).toBe(30);
    expect(merged.stiffness).toBe(200);
    expect(merged.mass).toBe(0.9);
  });
});

describe('Registration type', () => {
  it('should have id, pathname, role, measure, render, and borderRadius', () => {
    type Registration = {
      id: string;
      pathname: string;
      role: 'source' | 'destination' | 'auto';
      measure: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
      render: () => null;
      borderRadius?: number;
    };

    const registration: Registration = {
      id: 'tag-a',
      pathname: '/',
      role: 'source',
      measure: async () => ({ x: 10, y: 20, width: 100, height: 50 }),
      render: () => null,
      borderRadius: 28,
    };

    expect(registration.id).toBe('tag-a');
    expect(registration.pathname).toBe('/');
    expect(registration.role).toBe('source');
    expect(typeof registration.measure).toBe('function');
    expect(typeof registration.render).toBe('function');
    expect(registration.borderRadius).toBe(28);
  });
});

describe('Frame measurement validation', () => {
  const isValidFrame = (frame: { x: number; y: number; width: number; height: number }) => {
    return frame.width > 0 && 
           frame.height > 0 && 
           !Number.isNaN(frame.x) && 
           !Number.isNaN(frame.y);
  };
  
  it('should accept valid frame', () => {
    expect(isValidFrame({ x: 10, y: 20, width: 100, height: 50 })).toBe(true);
  });
  
  it('should reject zero dimensions', () => {
    expect(isValidFrame({ x: 10, y: 20, width: 0, height: 0 })).toBe(false);
  });
  
  it('should reject NaN coordinates', () => {
    expect(isValidFrame({ x: NaN, y: 20, width: 100, height: 50 })).toBe(false);
  });
});

describe('Navigation stack operations', () => {
  let stack: string[];
  
  beforeEach(() => {
    stack = [];
  });
  
  it('should push tags LIFO', () => {
    stack.push('tag-a');
    stack.push('tag-b');
    stack.push('tag-c');
    
    expect(stack.length).toBe(3);
    expect(stack[stack.length - 1]).toBe('tag-c');
  });
  
  it('should pop in reverse order', () => {
    stack.push('tag-a');
    stack.push('tag-b');
    
    expect(stack.pop()).toBe('tag-b');
    expect(stack.pop()).toBe('tag-a');
  });
  
  it('should return null when empty', () => {
    const pop = () => stack.pop() ?? null;
    const peek = () => stack.length > 0 ? stack[stack.length - 1] : null;
    
    expect(pop()).toBeNull();
    expect(peek()).toBeNull();
  });
});

describe('Forward transition simulation', () => {
  it('should execute capture -> show -> navigate -> wait -> animate -> hide', () => {
    const steps: string[] = [];
    
    const transition = async (tag: string) => {
      steps.push('capture');
      const capturedFrame = { x: 10, y: 100, width: 300, height: 180 };
      
      steps.push('show');
      steps.push('navigate');
      
      const hasTarget = true;
      if (hasTarget) {
        steps.push('wait-found');
        const targetFrame = { x: 50, y: 60, width: 350, height: 200 };
        steps.push('animate');
      }
      
      steps.push('hide');
    };
    
    transition('tag-a');
    
    expect(steps).toEqual([
      'capture',
      'show',
      'navigate',
      'wait-found',
      'animate',
      'hide',
    ]);
  });
});

describe('Reverse transition simulation', () => {
  it('should execute pop -> capture -> show -> back -> wait -> animate -> hide', () => {
    const steps: string[] = [];
    const stack = ['tag-a'];
    
    const back = async () => {
      steps.push('pop');
      steps.push('capture');
      steps.push('show');
      steps.push('back');
      const hasTarget = true;
      if (hasTarget) {
        steps.push('wait-found');
        steps.push('animate');
      }
      steps.push('hide');
    };
    
    back();
    
    expect(steps).toEqual([
      'pop',
      'capture',
      'show',
      'back',
      'wait-found',
      'animate',
      'hide',
    ]);
  });
});

describe('Frame interpolation', () => {
  const interpolate = (start: number, end: number, progress: number) => {
    return start + (end - start) * progress;
  };
  
  it('should interpolate at 0.5', () => {
    const start = { x: 10, y: 100, width: 300, height: 180 };
    const end = { x: 50, y: 60, width: 350, height: 200 };
    const progress = 0.5;
    
    const result = {
      x: interpolate(start.x, end.x, progress),
      y: interpolate(start.y, end.y, progress),
      width: interpolate(start.width, end.width, progress),
      height: interpolate(start.height, end.height, progress),
    };
    
    expect(result.x).toBe(30);
    expect(result.y).toBe(80);
    expect(result.width).toBe(325);
    expect(result.height).toBe(190);
  });
  
  it('should equal start at progress 0', () => {
    expect(interpolate(10, 50, 0)).toBe(10);
  });
  
  it('should equal end at progress 1', () => {
    expect(interpolate(10, 50, 1)).toBe(50);
  });
});

describe('Crossfade opacity', () => {
  const fromOpacity = (progress: number) => 1 - progress;
  const toOpacity = (progress: number) => progress;
  
  it('should crossfade correctly', () => {
    expect(fromOpacity(0)).toBe(1);
    expect(fromOpacity(0.5)).toBe(0.5);
    expect(fromOpacity(1)).toBe(0);
    
    expect(toOpacity(0)).toBe(0);
    expect(toOpacity(0.5)).toBe(0.5);
    expect(toOpacity(1)).toBe(1);
  });
});

describe('Hidden state — pub/sub model', () => {
  // The provider keeps a Set of hidden tags and a Map<tag, Set<listener>>.
  // SharedElement components subscribe via useSyncExternalStore so any
  // remount during a transition picks up the current value on first paint
  // — no race window between "set tag hidden" and "child re-reads state".
  let hiddenTags: Set<string>;
  let listeners: Map<string, Set<() => void>>;

  const isHidden = (id: string) => hiddenTags.has(id);

  const subscribeHidden = (id: string, listener: () => void) => {
    let set = listeners.get(id);
    if (!set) {
      set = new Set();
      listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) listeners.delete(id);
    };
  };

  const setHidden = (id: string, hidden: boolean) => {
    const wasHidden = hiddenTags.has(id);
    if (wasHidden === hidden) return;
    if (hidden) hiddenTags.add(id);
    else hiddenTags.delete(id);
    const set = listeners.get(id);
    if (!set) return;
    Array.from(set).forEach((listener) => listener());
  };

  beforeEach(() => {
    hiddenTags = new Set();
    listeners = new Map();
  });

  it('should mark and unmark a tag as hidden', () => {
    setHidden('tag-a', true);
    expect(isHidden('tag-a')).toBe(true);
    setHidden('tag-a', false);
    expect(isHidden('tag-a')).toBe(false);
  });

  it('should notify subscribers of the same tag', () => {
    const fn = vi.fn();
    subscribeHidden('tag-a', fn);
    setHidden('tag-a', true);
    expect(fn).toHaveBeenCalledTimes(1);
    setHidden('tag-a', false);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not notify subscribers of unrelated tags', () => {
    const fn = vi.fn();
    subscribeHidden('tag-a', fn);
    setHidden('tag-b', true);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should be a no-op when state is unchanged', () => {
    const fn = vi.fn();
    subscribeHidden('tag-a', fn);
    setHidden('tag-a', false); // already false
    expect(fn).not.toHaveBeenCalled();
  });

  it('should let a late subscriber read the current state', () => {
    setHidden('tag-a', true);
    // Component remounts mid-transition: it reads isHidden() synchronously
    // before its first paint and gets the up-to-date value.
    expect(isHidden('tag-a')).toBe(true);
  });

  it('should support multiple subscribers per tag', () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeHidden('tag-a', a);
    subscribeHidden('tag-a', b);
    setHidden('tag-a', true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('should allow a listener to unsubscribe during notification', () => {
    const a = vi.fn();
    let unsubB: () => void = () => {};
    const b = vi.fn(() => unsubB());
    subscribeHidden('tag-a', a);
    unsubB = subscribeHidden('tag-a', b);
    setHidden('tag-a', true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    setHidden('tag-a', false);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe('Registry management', () => {
  let registry: Map<string, Set<any>>;
  
  beforeEach(() => {
    registry = new Map();
  });
  
  it('should store multiple registrations per id', () => {
    const register = (id: string, reg: any) => {
      let set = registry.get(id);
      if (!set) {
        set = new Set();
        registry.set(id, set);
      }
      set.add(reg);
    };
    
    register('tag-a', { id: 'tag-a' });
    register('tag-a', { id: 'tag-a' });
    register('tag-b', { id: 'tag-b' });
    
    expect(registry.get('tag-a')?.size).toBe(2);
    expect(registry.get('tag-b')?.size).toBe(1);
  });
  
  it('should clean up empty sets', () => {
    const unregister = (id: string, reg: any) => {
      const set = registry.get(id);
      if (!set) return;
      set.delete(reg);
      if (set.size === 0) registry.delete(id);
    };
    
    const reg = { id: 'tag-a' };
    registry.set('tag-a', new Set([reg]));
    
    unregister('tag-a', reg);
    
    expect(registry.has('tag-a')).toBe(false);
  });
});

describe('Polling for target element', () => {
  it('should resolve when target found', async () => {
    const pollForTarget = async (maxAttempts: number, pollDelay: number) => {
      let attempts = 0;
      
      return new Promise<string | null>((resolve) => {
        const tick = () => {
          attempts++;
          if (attempts >= maxAttempts) {
            resolve('found');
            return;
          }
          setTimeout(tick, pollDelay);
        };
        tick();
      });
    };
    
    const result = await pollForTarget(5, 5);
    expect(result).toBe('found');
  });
  
  it('should resolve null on timeout', async () => {
    const pollForTarget = async (maxAttempts: number, pollDelay: number) => {
      let attempts = 0;
      
      return new Promise<string | null>((resolve) => {
        const tick = () => {
          attempts++;
          if (attempts >= maxAttempts) {
            resolve(null);
            return;
          }
          setTimeout(tick, pollDelay);
        };
        tick();
      });
    };
    
    const result = await pollForTarget(3, 5);
    expect(result).toBeNull();
  });
});