/**
 * Maps raw errors (from fetch, Gemini, Firestore, network stacks, image upload,
 * etc.) into a consistent `FriendlyError` shape the UI can render:
 *
 *   { title, message, action, kind, isRetryable }
 *
 * `kind` is one of:
 *   - 'offline'   — device has no network; user should reconnect.
 *   - 'auth'      — session expired or signed out; user should re-sign-in.
 *   - 'permission'— auth is valid but action is not allowed.
 *   - 'quota'     — rate limit / tier quota / AI overload (transient).
 *   - 'transient' — server hiccup / 5xx / timeout (retry works).
 *   - 'input'     — 4xx from bad input; user should fix & retry.
 *   - 'unknown'   — fallback.
 *
 * No raw stack trace or provider error code should leave this module.
 */

const DEFAULT_ACTION = 'Try again'

/**
 * @typedef {Object} FriendlyError
 * @property {string} title        Short headline shown in the UI.
 * @property {string} message      One-sentence recovery hint.
 * @property {string} action       Label for the primary CTA (e.g. "Try again").
 * @property {('offline'|'auth'|'permission'|'quota'|'transient'|'input'|'unknown')} kind
 * @property {boolean} isRetryable Whether the same action is likely to succeed on retry.
 * @property {string} [rawCode]    Optional raw error message for diagnostics/"Report this".
 */

function rawText(err) {
  if (!err) return ''
  if (typeof err === 'string') return err
  if (err.message) return String(err.message)
  try { return String(err) } catch { return '' }
}

/**
 * Translate any error-like value into a FriendlyError.
 *
 * @param {unknown} err
 * @param {Object} [opts]
 * @param {string} [opts.context] Short hint for the headline (e.g. 'plants', 'photo analysis').
 * @param {boolean} [opts.online] Override navigator.onLine (useful for tests).
 * @returns {FriendlyError}
 */
export function toFriendlyError(err, opts = {}) {
  const raw = rawText(err)
  const context = opts.context || ''
  const online = opts.online ?? (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

  if (online === false) {
    return {
      title: "You're offline",
      message:
        'Changes you make are saved on this device and will sync automatically when you reconnect.',
      action: 'Retry',
      kind: 'offline',
      isRetryable: true,
      rawCode: raw,
    }
  }

  if (/failed to fetch|networkerror|network error|load failed|network request failed|ERR_NETWORK/i.test(raw)) {
    return {
      title: "Couldn't reach the server",
      message: 'Check your connection — the internet blinked while we were talking to the server.',
      action: 'Retry',
      kind: 'transient',
      isRetryable: true,
      rawCode: raw,
    }
  }

  // Upload-specific failures carry their own 4xx/5xx codes — route them to the
  // dedicated recovery copy before the generic auth/permission branches fire.
  if (/GCS upload failed|upload failed/i.test(raw)) {
    return {
      title: "Couldn't upload that photo",
      message: 'Check your connection, then try uploading the photo again.',
      action: 'Retry upload',
      kind: 'transient',
      isRetryable: true,
      rawCode: raw,
    }
  }

  if (/\b401\b|unauthenticated|unauthorized|session expired|invalid token|token expired/i.test(raw)) {
    return {
      title: 'Your session has expired',
      message: 'Please sign in again to keep your changes safe.',
      action: 'Sign in again',
      kind: 'auth',
      isRetryable: false,
      rawCode: raw,
    }
  }

  if (/\b403\b|permission_denied|forbidden|not allowed/i.test(raw)) {
    return {
      title: "You don't have access",
      message:
        context
          ? `Your account can't ${context} right now. If you think this is a mistake, sign out and back in.`
          : "Your account doesn't have access to this action.",
      action: 'Sign in again',
      kind: 'permission',
      isRetryable: false,
      rawCode: raw,
    }
  }

  if (/\b429\b|rate limit|rate_limit|resource_exhausted|too many requests|quota/i.test(raw)) {
    return {
      title: 'Busy right now',
      message:
        'The AI assistant is getting a lot of requests. Give it a few seconds and try again.',
      action: 'Try again',
      kind: 'quota',
      isRetryable: true,
      rawCode: raw,
    }
  }

  if (/overloaded|high demand|\b503\b|service unavailable/i.test(raw)) {
    return {
      title: 'The service is under heavy load',
      message: "We'll be up again in a moment. Retrying usually does the trick.",
      action: 'Retry',
      kind: 'transient',
      isRetryable: true,
      rawCode: raw,
    }
  }

  if (/\b(502|504)\b|gateway|timeout|timed? ?out/i.test(raw)) {
    return {
      title: 'The server took too long',
      message: "That's usually a blip — retrying normally fixes it.",
      action: 'Retry',
      kind: 'transient',
      isRetryable: true,
      rawCode: raw,
    }
  }

  if (/\b5\d\d\b|internal server error|unexpected response from server/i.test(raw)) {
    return {
      title: 'Something went wrong on our side',
      message: "We've logged the error. Retrying usually works.",
      action: 'Retry',
      kind: 'transient',
      isRetryable: true,
      rawCode: raw,
    }
  }

  if (/position \d+/i.test(raw) && /object key|expected/i.test(raw)) {
    return {
      title: 'The AI gave an unexpected response',
      message: 'Our plant assistant got confused — please try again in a moment.',
      action: 'Try again',
      kind: 'transient',
      isRetryable: true,
      rawCode: raw,
    }
  }

  if (/\b400\b|bad request|invalid|required|must be/i.test(raw)) {
    return {
      title: "That didn't look right",
      message:
        raw.replace(/^\s*(error|http\s*\d+:?)\s*/i, '').trim() ||
        "The server rejected that input — please review and try again.",
      action: 'Review',
      kind: 'input',
      isRetryable: false,
      rawCode: raw,
    }
  }

  if (/\b404\b|not found/i.test(raw)) {
    return {
      title: "We couldn't find that",
      message:
        context
          ? `The ${context} you were looking for no longer exists.`
          : "The item you were looking for no longer exists.",
      action: 'Go back',
      kind: 'input',
      isRetryable: false,
      rawCode: raw,
    }
  }

  return {
    title: context ? `Something went wrong with ${context}` : 'Something went wrong',
    message:
      'This is usually temporary. If it keeps happening, refresh the page or try again in a minute.',
    action: DEFAULT_ACTION,
    kind: 'unknown',
    isRetryable: true,
    rawCode: raw,
  }
}

/**
 * Shortcut: translate an error and return only its message string. Useful for
 * `toast.error(...)` surfaces that don't need full context.
 */
export function friendlyErrorMessage(err, opts) {
  return toFriendlyError(err, opts).message
}
