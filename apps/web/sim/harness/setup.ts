// Build-time constants Vite normally injects; the sim runs the app's modules
// directly in Node.
if (!("__APP_VERSION__" in globalThis)) {
  Reflect.set(globalThis, "__APP_VERSION__", "sim");
}
