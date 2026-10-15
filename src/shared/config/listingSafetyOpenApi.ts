import {
  LISTING_QUALITIES,
  LISTING_SIZES,
} from '../../modules/products/validators/productValidator';

export const listingSafetySchemas = {
  ListingEdit: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 100,
        description: 'Trimmed before validation.',
      },
      description: { type: 'string', maxLength: 500 },
      categoryId: {
        type: 'string',
        description: 'Existing category document ID.',
      },
      quality: { type: 'string', enum: LISTING_QUALITIES },
      size: { type: 'string', enum: LISTING_SIZES },
      product_images: {
        type: 'array',
        minItems: 1,
        maxItems: 10,
        uniqueItems: true,
        items: { type: 'string', format: 'uri' },
        description: 'Ordered image URLs. First photo is the main image.',
      },
    },
  },
  ListingSafetyError: {
    type: 'object',
    required: ['success', 'code', 'message'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      code: { type: 'string' },
      message: { type: 'string' },
      error: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },
};
const response = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ListingSafetyError' },
    },
  },
});
export const listingSafetyResponses = {
  ListingValidationError: response(
    'LISTING_VALIDATION_FAILED or LISTING_INVALID_CATEGORY. No changes committed.',
  ),
  ListingAuthenticationError: {
    description: 'A valid Firebase ID token is required. Uses the existing authentication error envelope (success, message, error, timestamp).',
  },
  ListingOwnershipError: response(
    'LISTING_NOT_OWNER or PAYMENT_NOT_OWNER. The authenticated user does not own the resource.',
  ),
  ListingNotFoundError: response('LISTING_NOT_FOUND.'),
  ListingConflictError: response(
    'LISTING_PAYMENT_PENDING, LISTING_HAS_SALES, LISTING_NOT_EDITABLE, LISTING_NOT_AVAILABLE, CHECKOUT_EXPIRED, CHECKOUT_FINISHED, PAYMENT_STILL_ACTIONABLE, PAYMENT_RECONCILIATION_REQUIRED or ACCOUNT_DELETION_PENDING. Refresh or seek support as appropriate.',
  ),
};
