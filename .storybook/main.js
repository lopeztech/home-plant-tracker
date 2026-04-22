/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: [
    '../src/stories/**/*.stories.@(js|jsx)',
    '../src/components/**/*.stories.@(js|jsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  // Suppress the VitePWA plugin inside Storybook builds — it causes issues
  // in the Storybook iframe context (no index.html target).
  viteFinal: async (config) => {
    // Remove VitePWA — it doesn't work in Storybook's iframe context
    config.plugins = (config.plugins || []).filter(
      (p) => !p || !Array.isArray(p)
        ? !(p?.name?.includes('vite-plugin-pwa'))
        : !p.some((sub) => sub?.name?.includes('vite-plugin-pwa'))
    )

    // Silence Sass deprecation warnings coming from Bootstrap's @import syntax
    config.css = config.css || {}
    config.css.preprocessorOptions = config.css.preprocessorOptions || {}
    config.css.preprocessorOptions.scss = {
      ...config.css.preprocessorOptions.scss,
      silenceDeprecations: [
        'import',
        'mixed-decls',
        'color-functions',
        'global-builtin',
        'legacy-js-api',
      ],
      quietDeps: true,
    }

    return config
  },
}

export default config
