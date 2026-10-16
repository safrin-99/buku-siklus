import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * BrowserRouter does no scroll handling: a new screen opened at the previous screen's offset, and Back landed at an
 * offset the browser guessed before the list had rendered. Here: a new screen starts at the top, Back/Forward return
 * to where that entry was left, and a change of search parameters only (filters, calendar month) keeps the offset.
 */
export function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const offsets = useRef(new Map<string, number>());
  const lastPathname = useRef<string | null>(null);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Layout effects: the listener moves to the new entry in the same commit that swaps the screen, so a scroll event
  // caused by the swap (a shorter page clamping the offset) is never recorded for the entry that was left.
  useLayoutEffect(() => {
    const key = location.key;
    const record = () => offsets.current.set(key, window.scrollY);
    window.addEventListener('scroll', record, { passive: true });
    return () => window.removeEventListener('scroll', record);
  }, [location.key]);

  useLayoutEffect(() => {
    const pathnameChanged = lastPathname.current !== location.pathname;
    lastPathname.current = location.pathname;
    if (navigationType !== 'POP') {
      if (pathnameChanged) window.scrollTo(0, 0);
      return;
    }
    const target = offsets.current.get(location.key) ?? 0;
    window.scrollTo(0, target);
    // Cached data renders in the same commit; if the page is still shorter (data loading), retry for a few frames
    // and give up as soon as the user scrolls or the target is reached.
    let frames = 0;
    let frame = 0;
    const stop = () => cancelAnimationFrame(frame);
    const retry = () => {
      if (Math.abs(window.scrollY - target) <= 1 || frames++ >= 20) return;
      window.scrollTo(0, target);
      frame = requestAnimationFrame(retry);
    };
    frame = requestAnimationFrame(retry);
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });
    return () => {
      stop();
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    };
  }, [location.key, location.pathname, navigationType]);

  return null;
}
