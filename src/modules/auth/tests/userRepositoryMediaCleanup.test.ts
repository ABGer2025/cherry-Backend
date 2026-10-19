jest.mock('../../../shared/config/firebaseConfig', () => ({
  firestore: {},
}));

import { UserRepository } from '../repositories/UserRepository';

describe('UserRepository account media cleanup', () => {
  it('deletes every file under the authenticated user product prefix', async () => {
    const productFiles = [
      { name: 'products/user-1/image-1.jpg', delete: jest.fn().mockResolvedValue(undefined) },
      { name: 'products/user-1/orphaned.jpg', delete: jest.fn().mockResolvedValue(undefined) },
    ];
    const bucket = {
      getFiles: jest.fn().mockResolvedValueOnce([productFiles]),
    };
    const repository = new UserRepository(bucket);

    await (repository as any).deleteUserProductMedia('user-1');

    expect(bucket.getFiles).toHaveBeenNthCalledWith(1, { prefix: 'products/user-1/' });
    expect(productFiles[0].delete).toHaveBeenCalledTimes(1);
    expect(productFiles[1].delete).toHaveBeenCalledTimes(1);
  });

  it('logs failed file deletes without throwing', async () => {
    const error = new Error('storage unavailable');
    const file = {
      name: 'products/user-1/edit-1.png',
      delete: jest.fn().mockRejectedValue(error),
    };
    const bucket = {
      getFiles: jest.fn().mockResolvedValueOnce([[file]]),
    };
    const logSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const repository = new UserRepository(bucket);

    await expect((repository as any).deleteUserProductMedia('user-1')).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(
      'Account product media cleanup failed',
      expect.objectContaining({
        firebaseUid: 'user-1',
        prefix: 'products/user-1/',
        failedFiles: ['products/user-1/edit-1.png'],
      }),
    );
    logSpy.mockRestore();
  });
});
