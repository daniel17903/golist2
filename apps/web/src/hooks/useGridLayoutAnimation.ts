import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { Item } from "@golist/shared/domain/types";

const MOVE_DURATION_MS = 240;
const ENTER_DURATION_MS = 260;

const ENTER_KEYFRAMES: Keyframe[] = [
  { transform: "scale(0.85) rotate(-2deg)", opacity: 0, offset: 0 },
  { transform: "scale(1.06) rotate(1.5deg)", opacity: 1, offset: 0.6 },
  { transform: "scale(1) rotate(0deg)", opacity: 1, offset: 1 },
];

type GridPosition = { left: number; top: number };

const measurePositions = (grid: HTMLElement) => {
  const positions = new Map<string, GridPosition>();
  for (const card of grid.children) {
    if (card instanceof HTMLElement && card.dataset.itemId) {
      positions.set(card.dataset.itemId, { left: card.offsetLeft, top: card.offsetTop });
    }
  }
  return positions;
};

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Animates the item grid when its contents change (FLIP): cards that moved
// because an item was added, removed or re-sorted glide from their previous
// spot instead of jumping, and newly appearing cards pop in. Positions are
// read from offsetLeft/offsetTop relative to the grid (`.list-grid` is
// position: relative), so page scrolling never counts as movement.
// Nothing animates on first render or when switching lists.
export const useGridLayoutAnimation = (
  gridRef: RefObject<HTMLElement | null>,
  items: Item[],
  listId: string | undefined,
) => {
  const positionsRef = useRef<Map<string, GridPosition>>(new Map());
  const renderedListIdRef = useRef<string | undefined>(undefined);
  const hasRenderedRef = useRef(false);
  const moveAnimationsRef = useRef<WeakMap<HTMLElement, Animation>>(new WeakMap());

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const previousPositions = positionsRef.current;
    const nextPositions = new Map<string, GridPosition>();
    const canAnimate =
      hasRenderedRef.current && renderedListIdRef.current === listId && !prefersReducedMotion();

    for (const card of grid.children) {
      if (!(card instanceof HTMLElement) || !card.dataset.itemId) {
        continue;
      }
      const itemId = card.dataset.itemId;
      const position = { left: card.offsetLeft, top: card.offsetTop };
      nextPositions.set(itemId, position);

      if (!canAnimate) {
        continue;
      }

      const previous = previousPositions.get(itemId);
      if (!previous) {
        card.animate(ENTER_KEYFRAMES, { duration: ENTER_DURATION_MS, easing: "ease-out" });
        continue;
      }

      let deltaX = previous.left - position.left;
      let deltaY = previous.top - position.top;
      if (deltaX === 0 && deltaY === 0) {
        continue;
      }

      // A card that is still gliding from an earlier change continues from
      // where it currently is on screen rather than snapping back to its
      // previous layout slot first.
      const runningMove = moveAnimationsRef.current.get(card);
      if (runningMove && runningMove.playState === "running") {
        const current = new DOMMatrixReadOnly(getComputedStyle(card).transform);
        deltaX += current.m41;
        deltaY += current.m42;
        runningMove.cancel();
      }

      // Additive, so the glide stacks on top of the card's own CSS transform
      // (the check-off "poof", the press feedback) instead of replacing it.
      const move = card.animate(
        [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: "translate(0, 0)" }],
        { duration: MOVE_DURATION_MS, easing: "ease-out", composite: "add" },
      );
      moveAnimationsRef.current.set(card, move);
    }

    positionsRef.current = nextPositions;
    renderedListIdRef.current = listId;
    hasRenderedRef.current = true;
  }, [gridRef, items, listId]);

  // A resize or orientation change reflows the grid without an item change;
  // re-measure (without animating) so the next change starts from the
  // cards' current slots rather than the pre-resize layout.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      positionsRef.current = measurePositions(grid);
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [gridRef]);
};
