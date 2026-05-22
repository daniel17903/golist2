const preventGesture = (event: Event) => {
  event.preventDefault();
};

const preventMultiTouchStart = (event: TouchEvent) => {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
};

const preventMultiTouchMove = (event: TouchEvent) => {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
};

const preventCtrlWheelZoom = (event: WheelEvent) => {
  if (event.ctrlKey) {
    event.preventDefault();
  }
};

export const installZoomBlockers = () => {
  document.addEventListener("gesturestart", preventGesture);
  document.addEventListener("gesturechange", preventGesture);
  document.addEventListener("gestureend", preventGesture);
  document.addEventListener("touchstart", preventMultiTouchStart, { passive: false });
  document.addEventListener("touchmove", preventMultiTouchMove, { passive: false });
  document.addEventListener("wheel", preventCtrlWheelZoom, { passive: false });
};
