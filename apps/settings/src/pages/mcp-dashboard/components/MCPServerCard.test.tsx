import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, vi } from 'vitest';
import { MCPServerCard } from './MCPServerCard';

describe('MCPServerCard', () => {
  const baseServer = {
    id: 'tavily',
    name: 'Tavily',
    description: 'Search',
    enabled: false,
    command: 'tavily',
    args: [],
    env: null,
    apiKeyRequired: true,
    apiKey: undefined,
    status: 'disconnected' as const,
    category: 'search',
    recommended: false,
  };

  test('loads previously saved API key when opening editor', async () => {
    const onUpdateApiKey = vi.fn().mockResolvedValue(undefined);
    const onRequestSecretValue = vi.fn().mockResolvedValue('tvly_saved_key');
    const user = userEvent.setup();

    render(
      <MCPServerCard
        server={baseServer}
        onUpdateApiKey={onUpdateApiKey}
        onRequestSecretValue={onRequestSecretValue}
      />
    );

    await user.click(screen.getByText('serverCard.buttons.configure'));

    expect(onRequestSecretValue).toHaveBeenCalledWith('tavily');

    await waitFor(() => {
      expect(screen.getByPlaceholderText('serverCard.inputs.apiKeyPlaceholder')).toHaveValue('tvly_saved_key');
    });

    const toggleVisibility = screen.getByRole('button', { name: /serverCard\.inputs\.showSecret/i });
    await user.click(toggleVisibility);
    expect(screen.getByDisplayValue('tvly_saved_key')).toHaveAttribute('type', 'text');
  });

  test('saves new API key and returns to compact state', async () => {
    const onUpdateApiKey = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <MCPServerCard
        server={baseServer}
        onUpdateApiKey={onUpdateApiKey}
      />
    );

    await user.click(screen.getByText('serverCard.buttons.configure'));

    const input = screen.getByPlaceholderText('serverCard.inputs.apiKeyPlaceholder');
    await user.type(input, 'tvly_new_key');

    await user.click(screen.getByRole('button', { name: 'common.actions.save' }));

    await waitFor(() => {
      expect(onUpdateApiKey).toHaveBeenCalledWith('tavily', 'tvly_new_key');
    });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('serverCard.inputs.apiKeyPlaceholder')).not.toBeInTheDocument();
    });

    expect(screen.getByText('serverCard.buttons.configure')).toBeInTheDocument();
  });
});
