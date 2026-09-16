import {
  checkoutShippingOptionsQueryValidator,
  createTestParcelValidator,
  pickupPointsQueryValidator,
} from '../validators/shippingValidator';

describe('shipping validators', () => {
  it('accepts a valid checkout shipping options query', () => {
    const { error, value } = checkoutShippingOptionsQueryValidator.validate({
      productId: 'product-1',
      servicePointId: '12345678',
      country: 'GB',
      postalCode: 'SW1A 1AA',
    });

    expect(error).toBeUndefined();
    expect(value.servicePointId).toBe('12345678');
  });

  it('rejects pickup points query without address', () => {
    const { error } = pickupPointsQueryValidator.validate({
      country: 'GB',
    });

    expect(error).toBeDefined();
  });

  it('accepts pickup points query with address only', () => {
    const { error } = pickupPointsQueryValidator.validate({
      country: 'GB',
      address: 'SE18 5AB',
      radius: 5000,
    });

    expect(error).toBeUndefined();
  });

  it('accepts a test parcel label request without a service point', () => {
    const { error } = createTestParcelValidator.validate({
      parcel: {
        name: 'Milo Testo',
        address: '10 High Street',
        house_number: '10',
        city: 'London',
        postal_code: 'SE18 5JY',
        country: 'GB',
        email: 'milo@yopmail.com',
        telephone: '+447700900000',
        request_label: true,
        shipment: {
          id: 8,
        },
        weight: '2.000',
        order_number: 'TEST-LABEL-004',
      },
    });

    expect(error).toBeUndefined();
  });
});
