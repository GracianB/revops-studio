// Browser smoke tests accept installed Chromium without changing CI defaults.
// Firefox keeps its Playwright default binary and launch arguments.
export function chromeLaunchSelection(env=process.env) {
  const binary=String(env.CHROMIUM_BIN||"").trim();
  return binary ? {executablePath:binary} : {channel:"chrome"};
}
