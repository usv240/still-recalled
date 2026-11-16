// Chrome flags for test profiles that need Chrome's built-in model. Puppeteer's defaults turn off background
// networking and the OptimizationHints feature, which is how Chrome downloads and serves Gemini Nano. Everything else,
// including --enable-automation (the browser still says it is automated), stays as Puppeteer sets it.
import puppeteer from 'puppeteer-core';

// With ignoreDefaultArgs, Puppeteer drops its userDataDir option and starts a temporary profile, so the profile goes in
// as a flag.
export function builtInModelArgs({ headless = false, userDataDir } = {}) {
  return [...(userDataDir ? [`--user-data-dir=${userDataDir}`] : []), ...puppeteer.defaultArgs({ headless, enableExtensions: true })]
    .filter(a => a !== '--disable-background-networking' && a !== 'about:blank')
    .map(a => a.startsWith('--disable-features=') ? '--disable-features=' + a.slice(19).split(',').filter(f => f !== 'OptimizationHints').join(',') : a);
}
