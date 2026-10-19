/* Transient navigation state only. Persistent learning data lives in Firestore. */
const LAST_RESULT = "vocabApp_lastResult";
const LAST_RESULT_BACKUP = "vocabApp_lastResult_backup";
const RESULT_TTL_MS = 15 * 60 * 1000;

function parseStoredResult(raw) {
  try {
    const value = JSON.parse(raw || "null");

    if (!value || typeof value !== "object") {
      return null;
    }

    const savedAt = Number(value.__transientSavedAt || 0);

    if (
      savedAt > 0 &&
      Date.now() - savedAt > RESULT_TTL_MS
    ) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

export function saveLastResult(result) {
  const payload = {
    ...(result || {}),
    __transientSavedAt: Date.now()
  };

  const serialized = JSON.stringify(payload);

  /*
    sessionStorage is the primary transport between game.html -> result.html.
    localStorage is a short-lived backup for browsers that occasionally lose
    session navigation state during a fast replace/navigation.
  */
  sessionStorage.setItem(LAST_RESULT, serialized);

  try {
    localStorage.setItem(LAST_RESULT_BACKUP, serialized);
  } catch {
    /* Result page can still use sessionStorage. */
  }
}

export function getLastResult() {
  const primary = parseStoredResult(
    sessionStorage.getItem(LAST_RESULT)
  );

  if (primary) {
    return primary;
  }

  try {
    return parseStoredResult(
      localStorage.getItem(LAST_RESULT_BACKUP)
    );
  } catch {
    return null;
  }
}

export function clearLastResult() {
  sessionStorage.removeItem(LAST_RESULT);

  try {
    localStorage.removeItem(LAST_RESULT_BACKUP);
  } catch {
    /* Ignore storage cleanup errors. */
  }
}
