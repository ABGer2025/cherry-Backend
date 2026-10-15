jest.mock('../../../shared/config/firebaseConfig', () => ({
  firestore: {},
}));

import { UserBlockRepository } from '../repositories/UserBlockRepository';

describe('UserBlockRepository', () => {
  it('uses collision-free document IDs for block pairs', async () => {
    const refs: string[] = [];
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn((id: string) => {
          refs.push(id);
          return {
            set: jest.fn().mockResolvedValue(undefined),
          };
        }),
      }),
    };
    const repository = new UserBlockRepository(db as any);

    await repository.block('a_', 'b');
    await repository.block('a', '_b');

    expect(refs).toHaveLength(2);
    expect(refs[0]).not.toBe(refs[1]);
    expect(refs.every((id) => !id.includes('/'))).toBe(true);
  });

  it('checks a specific block pair without listing all blocked users', async () => {
    const get = jest.fn().mockResolvedValue({ exists: true });
    const doc = jest.fn().mockReturnValue({ get });
    const where = jest.fn();
    const db = {
      collection: jest.fn().mockReturnValue({ doc, where }),
    };
    const repository = new UserBlockRepository(db as any);

    await expect(repository.isBlocked('viewer', 'seller')).resolves.toBe(true);

    expect(doc).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(where).not.toHaveBeenCalled();
  });

  it('recognises matching legacy block documents without trusting collisions', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ blockerId: 'viewer', blockedUserId: 'seller' }),
      })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ blockerId: 'view_er', blockedUserId: 'seller' }),
      });
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ get }),
      }),
    };
    const repository = new UserBlockRepository(db as any);

    await expect(repository.isBlocked('viewer', 'seller')).resolves.toBe(true);
    await expect(repository.isBlocked('viewer', 'seller')).resolves.toBe(false);
  });

  it('only deletes matching legacy block documents when unblocking', async () => {
    const deleteNew = jest.fn().mockResolvedValue(undefined);
    const deleteLegacy = jest.fn().mockResolvedValue(undefined);
    const doc = jest
      .fn()
      .mockReturnValueOnce({ delete: deleteNew })
      .mockReturnValueOnce({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ blockerId: 'viewer', blockedUserId: 'seller' }),
        }),
        delete: deleteLegacy,
      });
    const db = {
      collection: jest.fn().mockReturnValue({ doc }),
    };
    const repository = new UserBlockRepository(db as any);

    await repository.unblock('viewer', 'seller');

    expect(deleteNew).toHaveBeenCalledTimes(1);
    expect(deleteLegacy).toHaveBeenCalledTimes(1);
  });
});
