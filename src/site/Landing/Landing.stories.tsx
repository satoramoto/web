import type { Meta, StoryObj } from '@storybook/react-vite';
import { Landing } from './Landing';

const meta = { title: 'Site/Satoramoto', component: Landing, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof Landing>;
export default meta;
type Story = StoryObj<typeof meta>;
const observatory = { variant: 'observatory', palette: 'silver-gold' } as const;

export const Mirrored: Story = { args: { ...observatory, labels: 'bare-text' } };
export const ContactRows: Story = { args: { ...observatory, labels: 'hairline-edge' } };
export const QuietPill: Story = { args: { ...observatory, labels: 'quiet-pill' } };
