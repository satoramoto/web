import type { Meta, StoryObj } from '@storybook/react-vite';
import { Landing } from './Landing';

const meta = {
  title: 'Site/Satoramoto',
  component: Landing,
  args: { variant: 'observatory', palette: 'silver-gold' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Landing>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Junction: Story = { args: { labels: 'junction' } };
export const Marginalia: Story = { args: { labels: 'marginalia' } };
export const Keybed: Story = { args: { labels: 'keybed' } };
export const ContactRows: Story = { args: { labels: 'hairline-edge' } };
export const QuietPill: Story = { args: { labels: 'quiet-pill' } };
