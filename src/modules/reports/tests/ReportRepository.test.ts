jest.mock('../../../shared/config/firebaseConfig', () => ({
  firestore: {},
}));

import { ReportRepository } from '../repositories/ReportRepository';

describe('ReportRepository', () => {
  it('clears resolution metadata when reopening a report', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest
            .fn()
            .mockResolvedValueOnce({ exists: true })
            .mockResolvedValueOnce({
              exists: true,
              data: () => ({
                reporterId: 'user-1',
                targetType: 'product',
                targetId: 'product-1',
                reason: 'bad',
                status: 'open',
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            }),
          update,
        }),
      }),
    };
    const repository = new ReportRepository(db as any);

    await repository.updateStatus('report-1', 'open', 'admin-1');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'open',
        resolvedAt: expect.anything(),
        resolvedBy: expect.anything(),
      }),
    );
  });
});
