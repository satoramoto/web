import { previewLabelHead } from '../scripts/preview-label.mjs';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
    '@storybook/addon-vitest',
    '@chromatic-com/storybook'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  managerHead: (head, { configType }) => head + (configType === 'DEVELOPMENT' ? previewLabelHead(process.env.PREVIEW_LABEL) : ''),
  previewHead: (head, { configType }) => head + (configType === 'DEVELOPMENT' ? previewLabelHead(process.env.PREVIEW_LABEL) : ''),
  async viteFinal(config, { configType }) {
    if (configType === 'DEVELOPMENT' && process.env.UNIFIED_STORYBOOK) {
      config.base = '/storybook/';
      config.server = {
        ...config.server,
        hmr: { ...(typeof config.server?.hmr === 'object' ? config.server.hmr : {}), clientPort: Number(process.env.PREVIEW_PORT), path: 'vite-hmr' },
      };
    }
    return config;
  },
};

export default config;
