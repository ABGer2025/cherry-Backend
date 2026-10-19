import {
  assertOwnedProductImages,
  ListingSafetyError,
} from '../../../shared/utils/listingSafety';

describe('listing media ownership', () => {
  it('accepts Firebase download URLs under the seller product prefix', () => {
    expect(() =>
      assertOwnedProductImages(
        [
          'https://firebasestorage.googleapis.com/v0/b/cherry/o/products%2Fseller-1%2Fimage.jpg?alt=media',
        ],
        'seller-1',
      ),
    ).not.toThrow();
  });

  it('rejects external and another seller media URLs', () => {
    expect(() =>
      assertOwnedProductImages(['https://example.com/image.jpg'], 'seller-1'),
    ).toThrow(
      new ListingSafetyError(
        400,
        'LISTING_MEDIA_NOT_OWNED',
        'Listing images must belong to the authenticated seller.',
      ),
    );

    expect(() =>
      assertOwnedProductImages(
        ['https://storage.googleapis.com/cherry/products/seller-2/image.jpg'],
        'seller-1',
      ),
    ).toThrow('Listing images must belong to the authenticated seller.');
  });
});
