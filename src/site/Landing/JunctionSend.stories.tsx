import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { scenario, type PlayContext } from 'story-spec';
import { Landing } from './Landing';

const meta = {
  title: 'Site/Satoramoto/Junction send',
  component: Landing,
  args: { variant: 'observatory', palette: 'silver-gold', labels: 'junction' },
  tags: ['browser'],
  parameters: {
    layout: 'fullscreen',
    spec: {
      capability: 'site-junction-contact',
      purpose: 'Let visitors send an inquiry from either Junction path and know whether it was accepted.',
      requirement: 'Contact acknowledgment',
      shall: 'The Junction SHALL acknowledge a submission only after the mail service accepts it and preserve the draft when the send is not confirmed.',
    },
  },
} satisfies Meta<typeof Landing>;
export default meta;
type Story = StoryObj<typeof meta>;

const email = 'visitor@example.test';
const message = 'I am building a better tool for researchers.';
const question = /^are you a visionary\s+building something revolutionary\?$/;
const send = 'send message';
const accepted = () => new Promise<void>(resolve => window.setTimeout(resolve, 480));
const notConfirmed = async () => { throw new Error('Storybook simulated an unconfirmed send'); };

async function openForm({ canvas, userEvent }: PlayContext) {
  await userEvent.click(canvas.getByRole('button', { name: question }));
  await canvas.findByRole('textbox', { name: 'what are you building?' });
}

async function writeMessage(context: PlayContext) {
  await openForm(context);
  const { canvas, userEvent } = context;
  await userEvent.type(canvas.getByRole('textbox', { name: 'your email' }), email);
  await userEvent.type(canvas.getByRole('textbox', { name: 'what are you building?' }), message);
}

export const WritingSurface: Story = {
  args: { sendContact: accepted },
  play: async context => {
    await openForm(context);
    const { canvas } = context;
    const find = (role: string, name: string) => canvas.getByRole(role, { name });
    const edge = (role: string, name: string) => find(role, name).getBoundingClientRect();
    const center = (rect: DOMRect) => rect.left + rect.width / 2;
    const emailField = edge('textbox', 'your email');
    const messageField = edge('textbox', 'what are you building?');
    const path = edge('combobox', 'choose a contact path');
    const action = edge('button', send);
    await expect(find('textbox', 'your email')).toHaveAttribute('placeholder', 'your email');
    await expect(find('textbox', 'what are you building?')).toHaveAttribute('placeholder', 'what are you building?');
    await expect(emailField.left).toBeCloseTo(messageField.left);
    await expect(path.left).toBeCloseTo(messageField.left);
    await expect(emailField.right).toBeCloseTo(messageField.right);
    await expect(center(action)).toBeCloseTo(center(messageField));
  },
};

const acceleratorDraft = 'I can make some compute available.';
const pathName = 'choose a contact path';
const acceleratorPrompt = 'what do you have to offer?';

export const SwitchPaths: Story = scenario({
  requirement: 'Contact paths',
  shall: 'The Junction SHALL distinguish the active contact path with its own scene and keep each role’s draft when the visitor changes paths.',
  given: 'a visitor has a visionary and an accelerator draft',
  when: 'they select accelerator from the visionary form',
  then: 'the gold scene opens on their accelerator draft without leaving the form',
  act: ({ canvas, userEvent }) => userEvent.selectOptions(canvas.getByRole('combobox', { name: pathName }), 'accelerator'),
  check: async ({ canvas }) => {
    const form = canvas.getByRole('form', { name: 'accelerator' });
    await expect(form.closest('.junction-console')).toHaveAttribute('data-scene', 'accelerator');
    await expect(canvas.getByRole('textbox', { name: acceleratorPrompt })).toHaveValue(acceleratorDraft);
    await expect(canvas.getByRole('textbox', { name: 'your email' })).toHaveValue(email);
  },
}, {
  args: { sendContact: accepted },
  play: async context => {
    await writeMessage(context);
    const { canvas, userEvent } = context;
    const path = canvas.getByRole('combobox', { name: pathName });
    await userEvent.selectOptions(path, 'accelerator');
    await userEvent.type(canvas.getByRole('textbox', { name: acceleratorPrompt }), acceleratorDraft);
    await userEvent.selectOptions(path, 'visionary');
  },
});

export const SignalReceived: Story = scenario({
  given: 'a visionary has written a message',
  when: 'they send it and the mail service accepts it',
  then: 'an inline thank-you takes focus',
  act: ({ canvas, userEvent }) => userEvent.click(canvas.getByRole('button', { name: send })),
  check: async ({ canvas }) => {
    const heading = await canvas.findByRole('heading', { name: 'thank you. signal received.' });
    await waitFor(() => expect(heading).toHaveFocus());
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  },
}, { args: { sendContact: accepted }, play: writeMessage });

export const TryAgain: Story = scenario({
  given: 'a visionary has written a message',
  when: 'they send it and the send is not confirmed',
  then: 'the visitor sees the failure with the original draft still ready to retry',
  act: ({ canvas, userEvent }) => userEvent.click(canvas.getByRole('button', { name: send })),
  check: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent('we couldn’t confirm the send');
    await expect(canvas.getByRole('textbox', { name: 'what are you building?' })).toHaveValue(message);
    await expect(canvas.getByRole('textbox', { name: 'your email' })).toHaveValue(email);
    await expect(canvas.getByRole('button', { name: send })).toBeEnabled();
    await expect(canvas.queryByRole('heading', { name: 'thank you. signal received.' })).not.toBeInTheDocument();
  },
}, { args: { sendContact: notConfirmed }, play: writeMessage });

export const Sending: Story = scenario({
  given: 'a visionary has written a message',
  when: 'the visitor sends it and a response is still pending',
  then: 'the Junction indicates the send in progress without offering a second send',
  act: ({ canvas, userEvent }) => userEvent.click(canvas.getByRole('button', { name: send })),
  check: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('sending…');
    await expect(canvas.getByRole('button', { name: send })).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByRole('combobox', { name: pathName })).toBeDisabled();
    await expect(canvas.queryByRole('heading', { name: 'thank you. signal received.' })).not.toBeInTheDocument();
  },
}, { args: { sendContact: () => new Promise<void>(() => {}) }, play: writeMessage });
