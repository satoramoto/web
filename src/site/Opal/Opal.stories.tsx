import type { Meta, StoryObj } from '@storybook/react-vite';
import { Opal } from './Opal';

const meta = { title: 'Site/Opal', component: Opal, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof Opal>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interference: Story = { args: { variant: 'interference' } };
export const Observatory: Story = { args: { variant: 'observatory' } };
export const StandingWave: Story = { args: { variant: 'standing' } };
