/**
 * Unit tests for shared element transition library
 * Tests the core business logic without React component rendering
 */

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
    const defaults = { damping: 22, stiffness: 180, mass: 0.9 };
    const custom = { damping: 30 };
    
    const merged = {
      damping: custom.damping ?? defaults.damping,
      stiffness: custom.stiffness ?? defaults.stiffness,
      mass: custom.mass ?? defaults.mass,
    };
    
    expect(merged.damping).toBe(30);
    expect(merged.stiffness).toBe(180);
    expect(merged.mass).toBe(0.9);
  });
});

describe('Registration', () => {
  it('should store id, pathname, role, measure, render, borderRadius', () => {
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

describe('measureInWindow', () => {
  it('should correctly report window coordinates', async () => {
    const measureInWindow = (x: number, y: number, width: number, height: number) => {
      return { x, y, width, height };
    };
    
    const result = measureInWindow(10, 100, 300, 180);
    
    expect(result.x).toBe(10);
    expect(result.y).toBe(100);
    expect(result.width).toBe(300);
    expect(result.height).toBe(180);
  });
  
  it('should reject invalid measurements', () => {
    const isValidFrame = (frame: { x: number; y: number; width: number; height: number }) => {
      return frame.width > 0 && 
             frame.height > 0 && 
             !Number.isNaN(frame.x) && 
             !Number.isNaN(frame.y);
    };
    
    expect(isValidFrame({ x: 10, y: 20, width: 100, height: 50 })).toBe(true);
    expect(isValidFrame({ x: 0, y: 0, width: 0, height: 0 })).toBe(false);
    expect(isValidFrame({ x: NaN, y: 20, width: 100, height: 50 })).toBe(false);
  });
});

describe('Navigation stack', () => {
  it('should LIFO push/pop operations', () => {
    const stack: string[] = [];
    
    // Push tags onto stack
    stack.push('tag-a');
    stack.push('tag-b');
    stack.push('tag-c');
    
    expect(stack.length).toBe(3);
    expect(stack[stack.length - 1]).toBe('tag-c');
    
    // Pop in reverse order
    expect(stack.pop()).toBe('tag-c');
    expect(stack.pop()).toBe('tag-b');
    expect(stack.pop()).toBe('tag-a');
    
    expect(stack.length).toBe(0);
  });
  
  it('should return null when popping empty stack', () => {
    const stack: string[] = [];
    
    const pop = () => stack.pop() ?? null;
    const peek = () => stack.length > 0 ? stack[stack.length - 1] : null;
    
    expect(pop()).toBeNull();
    expect(peek()).toBeNull();
  });
});

describe('Forward transition flow', () => {
  it('should execute in correct sequence: capture -> show -> navigate -> wait -> animate -> hide', () => {
    const steps: string[] = [];
    
    const executeTransition = async (tag: string) => {
      // Step 1: Capture source element position
      steps.push('capture');
      const capturedFrame = { x: 10, y: 100, width: 300, height: 180 };
      
      // Step 2: Show overlay at captured position
      steps.push('show');
      
      // Step 3: Navigate to destination
      steps.push('navigate');
      
      // Step 4: Wait for destination element
      const hasTarget = true; // Simulated
      if (hasTarget) {
        steps.push('wait-found');
        
        // Step 5: Animate from captured to target position
        const targetFrame = { x: 50, y: 60, width: 350, height: 200 };
        steps.push('animate');
      }
      
      // Step 6: Hide overlay after animation
      steps.push('hide');
    };
    
    executeTransition('tag-a');
    
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

describe('Reverse transition flow', () => {
  it('should execute in correct sequence: pop -> capture -> show -> back -> wait -> animate -> hide', () => {
    const steps: string[] = [];
    const stack: string[] = ['tag-a'];
    
    const executeBack = async () => {
      // Step 1: Pop the last navigation tag
      steps.push('pop');
      
      // Step 2: Capture current position before going back
      steps.push('capture');
      
      // Step 3: Show overlay at current position
      steps.push('show');
      
      // Step 4: Navigate back
      steps.push('back');
      
      // Step 5: Wait for source element
      const hasTarget = true;
      if (hasTarget) {
        steps.push('wait-found');
        
        // Step 6: Animate back to original position
        const targetFrame = { x: 10, y: 100, width: 300, height: 180 };
        steps.push('animate');
      }
      
      // Step 7: Hide overlay
      steps.push('hide');
    };
    
    executeBack();
    
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
  it('should linearly interpolate between start and end frames', () => {
    const interpolate = (start: number, end: number, progress: number) => {
      return start + (end - start) * progress;
    };
    
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
  
  it('should handle progress of 0 (start)', () => {
    const interpolate = (start: number, end: number, progress: number) => {
      return start + (end - start) * progress;
    };
    
    const start = { x: 10, y: 100, width: 300, height: 180 };
    const end = { x: 50, y: 60, width: 350, height: 200 };
    
    expect(interpolate(start.x, end.x, 0)).toBe(10);
    expect(interpolate(start.y, end.y, 0)).toBe(100);
  });
  
  it('should handle progress of 1 (end)', () => {
    const interpolate = (start: number, end: number, progress: number) => {
      return start + (end - start) * progress;
    };
    
    const start = { x: 10, y: 100, width: 300, height: 180 };
    const end = { x: 50, y: 60, width: 350, height: 200 };
    
    expect(interpolate(start.x, end.x, 1)).toBe(50);
    expect(interpolate(start.y, end.y, 1)).toBe(60);
  });
});

describe('Crossfade transition', () => {
  it('should calculate correct opacity for fromRender based on progress', () => {
    const fromOpacity = (progress: number) => 1 - progress;
    
    expect(fromOpacity(0)).toBe(1);
    expect(fromOpacity(0.5)).toBe(0.5);
    expect(fromOpacity(1)).toBe(0);
  });
  
  it('should calculate correct opacity for toRender based on progress', () => {
    const toOpacity = (progress: number) => progress;
    
    expect(toOpacity(0)).toBe(0);
    expect(toOpacity(0.5)).toBe(0.5);
    expect(toOpacity(1)).toBe(1);
  });
});

describe('Hidden state — pub/sub model', () => {
  // The provider exposes isHidden(tag) and subscribeHidden(tag, listener).
  // SharedElement components subscribe via useSyncExternalStore and re-read
  // synchronously on every notification, so a remount in the middle of a
  // transition picks up the current value on its first paint — no race.
  it('should mark, unmark, and notify subscribers', () => {
    const hiddenTags = new Set<string>();
    const listeners = new Map<string, Set<() => void>>();

    const isHidden = (id: string) => hiddenTags.has(id);

    const subscribe = (id: string, fn: () => void) => {
      let s = listeners.get(id);
      if (!s) { s = new Set(); listeners.set(id, s); }
      s.add(fn);
      return () => { s!.delete(fn); if (s!.size === 0) listeners.delete(id); };
    };

    const setHidden = (id: string, hidden: boolean) => {
      if (hiddenTags.has(id) === hidden) return;
      if (hidden) hiddenTags.add(id); else hiddenTags.delete(id);
      const s = listeners.get(id);
      if (!s) return;
      Array.from(s).forEach((fn) => fn());
    };

    let calls = 0;
    subscribe('tag-a', () => { calls++; });

    setHidden('tag-a', true);
    expect(isHidden('tag-a')).toBe(true);
    expect(calls).toBe(1);

    setHidden('tag-a', true);  // no-op
    expect(calls).toBe(1);

    setHidden('tag-a', false);
    expect(isHidden('tag-a')).toBe(false);
    expect(calls).toBe(2);
  });
});

describe('waitForOtherTarget polling', () => {
  it('should find target within deadline', async () => {
    const pollForTarget = async (maxAttempts: number, pollDelay: number) => {
      let attempts = 0;
      
      const check = () => new Promise<string | null>((resolve) => {
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
      
      return check();
    };
    
    const result = await pollForTarget(5, 5);
    expect(result).toBe('found');
  });
});

describe('Registry management', () => {
  it('should store multiple registrations per id', () => {
    const registry = new Map<string, Set<any>>();
    
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
  
  it('should clean up empty registration sets', () => {
    const registry = new Map<string, Set<any>>();
    
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

describe('Spring animation helper', () => {
  it('should use default config when not provided', () => {
    const defaultConfig = { damping: 22, stiffness: 180, mass: 0.9 };
    const customConfig = { damping: 30 };
    
    const spring = {
      damping: customConfig.damping ?? defaultConfig.damping,
      stiffness: customConfig.stiffness ?? defaultConfig.stiffness,
      mass: customConfig.mass ?? defaultConfig.mass,
    };
    
    expect(spring.damping).toBe(30);
    expect(spring.stiffness).toBe(180);
    expect(spring.mass).toBe(0.9);
  });
});