import ErrorAlert from './ErrorAlert'

export default {
  title: 'Primitives/ErrorAlert',
  component: ErrorAlert,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders a `FriendlyError` (from `toFriendlyError()`) with an appropriate ' +
          'icon, colour, recovery copy, and optional retry/dismiss actions. ' +
          'Pass a raw `Error` or string and it will be converted automatically.',
      },
    },
  },
}

const makeError = (kind, title, message, action = 'Try again') => ({
  kind,
  title,
  message,
  action,
  rawCode: `ERR_${kind.toUpperCase()}`,
})

export const Offline = {
  args: {
    error: makeError('offline', 'You\'re offline', 'Check your internet connection and try again.', 'Retry'),
    onRetry: () => {},
  },
}

export const Transient = {
  args: {
    error: makeError('transient', 'Something went wrong', 'The server returned an unexpected error. This is usually temporary.', 'Try again'),
    onRetry: () => {},
    onDismiss: () => {},
  },
}

export const Auth = {
  args: {
    error: makeError('auth', 'Session expired', 'Sign in again to continue.', 'Sign in'),
    onRetry: () => {},
  },
}

export const Quota = {
  args: {
    error: makeError('quota', 'Rate limit reached', 'You\'ve used all your AI analyses for this period. Upgrade to Home Pro for unlimited analyses.', 'See plans'),
  },
}

export const InputError = {
  name: 'Input validation',
  args: {
    error: makeError('input', 'Invalid input', 'Plant name must be at least 1 character.', undefined),
  },
}

export const DismissOnly = {
  name: 'Dismissible (no retry)',
  args: {
    error: makeError('transient', 'Could not save', 'Changes were not saved. Please try again.'),
    onDismiss: () => {},
  },
}

export const WithReport = {
  name: 'With "Report this" CTA',
  args: {
    error: makeError('unknown', 'Unexpected error', 'An unexpected error occurred. Please report this if it persists.'),
    onRetry: () => {},
    onDismiss: () => {},
    onReport: (code) => alert(`Reporting: ${code}`),
  },
}

export const SmallSize = {
  name: 'Small (inline)',
  args: {
    error: makeError('input', 'Required field', 'This field cannot be empty.'),
    size: 'sm',
  },
}

export const RawError = {
  name: 'From raw Error',
  args: {
    error: new Error('Network request failed'),
    context: 'loading plants',
    onRetry: () => {},
  },
}
