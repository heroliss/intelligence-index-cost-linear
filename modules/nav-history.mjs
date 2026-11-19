/**
 * Self-contained semantic navigation history stack synced with browser History API
 * (`pushState` / `popstate`) without polluting history on pan, zoom, or slider tweaks.
 */
export function createNavHistory({
  captureSnapshot,
  signatureOf,
  restoreSnapshot,
  buildUrlHash,
  onButtonsChange,
  historyApi = globalThis.history,
  locationApi = globalThis.location,
  maxStack = 50
}) {
  const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let stack = [];
  let index = -1;
  let uidSeq = 0;
  let depth = 0;
  let restoring = false;
  let suppressUrlReplace = false;

  const currentUrl = () => {
    const hash = buildUrlHash();
    const base = (locationApi?.pathname || '') + (locationApi?.search || '');
    return hash || base;
  };

  function syncButtons() {
    onButtonsChange?.({
      stack,
      index,
      canBack: index > 0,
      canForward: index >= 0 && index < stack.length - 1,
      hasHistory: stack.length > 1
    });
  }

  function init() {
    const snap = captureSnapshot();
    if (!snap) return;
    uidSeq++;
    stack = [{uid: uidSeq, snap}];
    index = 0;
    try {
      historyApi?.replaceState?.({__navSession: sessionId, navUid: uidSeq}, '', currentUrl());
    } catch {}
    syncButtons();
  }

  function commitPoint(beforeSnap, fallbackSyncUrl) {
    const afterSnap = captureSnapshot();
    if (!afterSnap) {
      syncButtons();
      return;
    }
    if (beforeSnap && signatureOf(beforeSnap) === signatureOf(afterSnap)) {
      fallbackSyncUrl?.();
      syncButtons();
      return;
    }
    if (!stack.length && beforeSnap) {
      stack.push({uid: ++uidSeq, snap: beforeSnap});
      index = 0;
    }
    stack.length = index + 1;
    const uid = ++uidSeq;
    stack.push({uid, snap: afterSnap});
    if (stack.length > maxStack) stack.shift();
    index = stack.length - 1;
    try {
      historyApi?.pushState?.({__navSession: sessionId, navUid: uid}, '', currentUrl());
    } catch {}
    syncButtons();
  }

  function runAction(fn, {canCommit = () => true, fallbackSyncUrl = null} = {}) {
    if (restoring || !canCommit() || depth > 0) return fn();
    depth++;
    const beforeSnap = captureSnapshot();
    if (stack.length && index >= 0 && index < stack.length && beforeSnap) {
      stack[index].snap = beforeSnap;
    }
    suppressUrlReplace = true;
    let result;
    try {
      result = fn();
    } finally {
      suppressUrlReplace = false;
      depth--;
    }
    commitPoint(beforeSnap, fallbackSyncUrl);
    return result;
  }

  function step(delta) {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= stack.length) return false;
    const curSnap = captureSnapshot();
    if (curSnap && stack[index]) stack[index].snap = curSnap;
    if (historyApi?.state?.__navSession === sessionId && typeof historyApi.back === 'function' && typeof historyApi.forward === 'function') {
      if (delta < 0) historyApi.back();
      else historyApi.forward();
      return true;
    }
    restoring = true;
    index = targetIdx;
    try {
      restoreSnapshot(stack[targetIdx].snap, delta < 0 ? 'back' : 'forward');
    } finally {
      restoring = false;
    }
    syncButtons();
    return true;
  }

  function handlePopState(eventState, onExternalHash) {
    if (eventState && eventState.__navSession === sessionId) {
      const targetIdx = stack.findIndex(item => item.uid === eventState.navUid);
      if (targetIdx !== -1 && targetIdx !== index) {
        const curSnap = captureSnapshot();
        if (curSnap && stack[index]) stack[index].snap = curSnap;
        const dir = targetIdx < index ? 'back' : 'forward';
        restoring = true;
        index = targetIdx;
        try {
          restoreSnapshot(stack[targetIdx].snap, dir);
        } finally {
          restoring = false;
        }
      }
      syncButtons();
      return true;
    }
    onExternalHash?.();
    const snap = captureSnapshot();
    if (snap) {
      stack.length = index + 1;
      const uid = ++uidSeq;
      stack.push({uid, snap});
      if (stack.length > maxStack) stack.shift();
      index = stack.length - 1;
      try {
        historyApi?.replaceState?.({__navSession: sessionId, navUid: uid}, '', currentUrl());
      } catch {}
      syncButtons();
    }
    return false;
  }

  return {
    sessionId,
    init,
    runAction,
    back: () => step(-1),
    forward: () => step(1),
    handlePopState,
    syncButtons,
    isRestoring: () => restoring,
    isSuppressingUrl: () => suppressUrlReplace || restoring,
    ownsCurrentHistory: () => historyApi?.state?.__navSession === sessionId,
    canBack: () => index > 0,
    canForward: () => index >= 0 && index < stack.length - 1,
    getState: () => ({stack, index})
  };
}
