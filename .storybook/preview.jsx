import { MemoryRouter } from 'react-router'
// Use pre-compiled Bootstrap CSS so Storybook avoids the full SCSS compilation
// (the SCSS pipeline uses Bootstrap @import syntax that fails in some Vite/Sass
// version combinations outside the main build context).
import 'bootstrap/dist/css/bootstrap.min.css'

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    backgrounds: {
      default: 'app-light',
      values: [
        { name: 'app-light', value: '#f4f6f0' },
        { name: 'app-dark',  value: '#14181e' },
        { name: 'white',     value: '#ffffff' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  // Wrap all stories in a MemoryRouter so Link components render without errors.
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export default preview
