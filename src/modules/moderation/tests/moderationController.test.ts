import {
  moderateProduct,
  moderateUser,
} from '../controllers/moderationController';

const mockModerateProduct = jest.fn();
const mockModerateUser = jest.fn();
const errorLog = jest
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

jest.mock('../repositories/ModerationRepository', () => ({
  ModerationRepository: jest.fn().mockImplementation(() => ({
    moderateProduct: mockModerateProduct,
    moderateUser: mockModerateUser,
  })),
}));

const response = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('moderationController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    errorLog.mockClear();
  });

  it('hides a product', async () => {
    mockModerateProduct.mockResolvedValue(true);
    const res = response();

    await moderateProduct(
      {
        user: { uid: 'admin-1' },
        params: { productId: 'product-1' },
        body: { action: 'hide', reason: 'prohibited_content' },
      } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockModerateProduct).toHaveBeenCalledWith(
      'product-1',
      'hide',
      'admin-1',
      'prohibited_content',
    );
  });

  it('suspends a user', async () => {
    mockModerateUser.mockResolvedValue(true);
    const res = response();

    await moderateUser(
      {
        user: { uid: 'admin-1' },
        params: { userId: 'user-2' },
        body: { action: 'suspend', reason: 'harassment' },
      } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockModerateUser).toHaveBeenCalledWith(
      'user-2',
      'suspend',
      'admin-1',
      'harassment',
    );
  });

  it('does not return raw moderation errors', async () => {
    mockModerateProduct.mockRejectedValue(
      new Error('firestore private@example.org internal-index-detail'),
    );
    const res = response();

    await moderateProduct(
      {
        user: { uid: 'admin-1' },
        params: { productId: 'product-1' },
        body: { action: 'hide', reason: 'prohibited_content' },
      } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toMatch(
      /private@example.org|internal-index-detail/,
    );
    expect(errorLog).toHaveBeenCalledWith('moderation.product_failed');
  });
});
