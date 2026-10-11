const updateUser = jest.fn();

jest.mock('../../../shared/config/firebaseConfig', () => ({
  firestore: {},
  admin: { auth: () => ({ updateUser }) },
}));

import { ModerationRepository } from '../repositories/ModerationRepository';

describe('ModerationRepository', () => {
  beforeEach(() => {
    updateUser.mockReset().mockResolvedValue({});
  });

  it('does not report success when warning a missing user', async () => {
    const get = jest.fn().mockResolvedValue({ empty: true, docs: [] });
    const db = {
      collection: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get,
      }),
    };
    const repository = new ModerationRepository(db as any);

    await expect(
      repository.moderateUser('missing-user', 'warn', 'admin-1', 'spam'),
    ).resolves.toBe(false);
  });

  it('updates Firebase Auth before writing Firestore suspension state', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [{ ref: { update } }],
        }),
      }),
    };
    const repository = new ModerationRepository(db as any);

    await expect(
      repository.moderateUser('user-1', 'suspend', 'admin-1', 'abuse'),
    ).resolves.toBe(true);

    expect(updateUser).toHaveBeenCalledWith('user-1', { disabled: true });
    expect(update).toHaveBeenCalledTimes(1);
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0],
    );
  });

  it('does not write Firestore suspension state when Firebase Auth fails', async () => {
    updateUser.mockRejectedValue(new Error('auth unavailable'));
    const update = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [{ ref: { update } }],
        }),
      }),
    };
    const repository = new ModerationRepository(db as any);

    await expect(
      repository.moderateUser('user-1', 'suspend', 'admin-1', 'abuse'),
    ).rejects.toThrow('auth unavailable');
    expect(update).not.toHaveBeenCalled();
  });
});
