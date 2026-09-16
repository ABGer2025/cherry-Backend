import Joi from 'joi';

export const testResendEmailSchema = Joi.object({
  to: Joi.string().email().required().messages({
    'string.base': '"to" should be a type of text',
    'string.empty': '"to" cannot be empty',
    'string.email': '"to" must be a valid email',
    'any.required': '"to" is required',
  }),
});
