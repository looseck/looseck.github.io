/* Small localStorage wrapper shared by modules.
   Modules remain responsible for using a mod-{id}- prefixed key. */

export function readJSON(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function removeJSON(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

export function readNumber(key, fallback = 0) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  } catch (error) {
    return fallback;
  }
}

export function writeNumber(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    return false;
  }
}
