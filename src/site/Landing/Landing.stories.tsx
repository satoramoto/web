import type { Meta, StoryObj } from '@storybook/react-vite';
import { Landing } from './Landing';
import '../site.css';

const meta = { title: 'Site/Satoramoto', component: Landing, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof Landing>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interference: Story = { args: { variant: 'interference' } };
export const Observatory: Story = { args: { variant: 'observatory' } };
export const StandingWave: Story = { args: { variant: 'standing' } };
