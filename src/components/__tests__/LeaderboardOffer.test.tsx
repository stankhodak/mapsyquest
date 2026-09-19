import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardEntry } from '../../lib/leaderboard';
import type { LeaderboardAccount } from '../LeaderboardOffer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  available: true,
  submitScore: vi.fn(),
  saveNickname: vi.fn(async () => undefined),
}));

vi.mock('../../lib/leaderboard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/leaderboard')>()),
  get isLeaderboardAvailable() {
    return mocks.available;
  },
  submitScore: mocks.submitScore,
  saveNickname: mocks.saveNickname,
}));

const { LeaderboardOffer } = await import('../LeaderboardOffer');

const entry: BoardEntry = { board: 'daily', period: '2026-09-19', score: 6100, stars: 18, achievementIds: ['big-score'] };
const account: LeaderboardAccount = { userId: 'user-1', suggestedNickname: 'Ada' };

let container: HTMLDivElement;
let root: Root;

async function render(props: Partial<Parameters<typeof LeaderboardOffer>[0]> = {}) {
  const onLogin = vi.fn();
  const onViewBoard = vi.fn();
  await act(async () => {
    root.render(<LeaderboardOffer entry={entry} account={account} onLogin={onLogin} onViewBoard={onViewBoard} {...props} />);
  });
  return { onLogin, onViewBoard };
}

const button = (label: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement | undefined;

async function click(label: string) {
  const b = button(label);
  expect(b, `button "${label}"`).toBeDefined();
  await act(async () => {
    b!.click();
  });
}

async function typeNickname(value: string) {
  const input = container.querySelector('input') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  mocks.available = true;
  mocks.submitScore.mockReset();
  mocks.saveNickname.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('LeaderboardOffer', () => {
  it('renders nothing when the game has nothing to post', async () => {
    await render({ entry: null });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when leaderboards are not set up', async () => {
    mocks.available = false;
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('asks a guest to log in', async () => {
    const { onLogin } = await render({ account: null });
    expect(container.textContent).toContain('Log in to post scores');
    await click('Log in');
    expect(onLogin).toHaveBeenCalledOnce();
  });

  it('offers a signed-in player the post form with the score and a prefilled nickname', async () => {
    await render();
    expect(container.textContent).toContain('6,100 pts on the Daily board');
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('Ada');
    expect(container.textContent).toContain('visible to everyone');
    expect(button('Add to leaderboard')?.disabled).toBe(false);
  });

  it('will not post without a nickname', async () => {
    await render({ account: { userId: 'user-1', suggestedNickname: '' } });
    expect(button('Add to leaderboard')?.disabled).toBe(true);
    await typeNickname('   ');
    expect(button('Add to leaderboard')?.disabled).toBe(true);
    await typeNickname('Mapsy');
    expect(button('Add to leaderboard')?.disabled).toBe(false);
  });

  it('posts the score under the chosen nickname and shows the rank', async () => {
    mocks.submitScore.mockResolvedValue({ ok: true, value: { improved: true, rank: 3 } });
    const { onViewBoard } = await render();
    await typeNickname('Mapsy');
    await click('Add to leaderboard');

    expect(mocks.submitScore).toHaveBeenCalledWith('user-1', 'Mapsy', entry);
    expect(mocks.saveNickname).toHaveBeenCalledWith('Mapsy');
    expect(container.textContent).toContain('Posted!');
    expect(container.textContent).toContain("You're #3");

    await click('View leaderboard');
    expect(onViewBoard).toHaveBeenCalledWith('daily');
  });

  it('says so when a better score was already on the board', async () => {
    mocks.submitScore.mockResolvedValue({ ok: true, value: { improved: false, rank: 2 } });
    await render();
    await click('Add to leaderboard');
    expect(container.textContent).toContain('Already on the board');
    expect(container.textContent).toContain('better score');
    expect(container.textContent).toContain("You're #2");
  });

  it('shows a friendly error, keeps the form, and lets the player retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.submitScore.mockResolvedValueOnce({ ok: false, error: 'relation "mapsyquest_leaderboard" does not exist' });
    await render();
    await click('Add to leaderboard');

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Couldn't post your score");
    // The raw database error is logged for developers but never shown to the player.
    expect(container.textContent).not.toContain('relation');
    expect(consoleError).toHaveBeenCalled();
    expect(saveNicknameCalls()).toBe(0);

    mocks.submitScore.mockResolvedValueOnce({ ok: true, value: { improved: true, rank: 1 } });
    await click('Try again');
    expect(container.textContent).toContain('Posted!');
    consoleError.mockRestore();
  });

  it('disables the button while posting so a double-click cannot post twice', async () => {
    let resolve!: (value: unknown) => void;
    mocks.submitScore.mockReturnValue(new Promise((r) => (resolve = r)));
    await render();
    await click('Add to leaderboard');
    expect(button('Posting')?.disabled).toBe(true);
    await click('Posting');
    expect(mocks.submitScore).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, value: { improved: true, rank: 1 } }));
  });
});

function saveNicknameCalls() {
  return mocks.saveNickname.mock.calls.length;
}
