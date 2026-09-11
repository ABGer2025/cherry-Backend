import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/authMiddleWare';
import { validateRequest } from '../../../shared/middleware/validateRequest';
import { sendTestResendEmail } from '../controllers/notificationController';
import { testResendEmailSchema } from '../validators/notificationValidator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Internal notification testing
 */

/**
 * @swagger
 * /api/notifications/test-resend:
 *   post:
 *     summary: "[TEST ONLY] Send a Resend test email"
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 example: "delivered@resend.dev"
 *     responses:
 *       200:
 *         description: Test email sent or skipped
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Resend send failed
 */
router.post(
  '/test-resend',
  authMiddleware,
  validateRequest(testResendEmailSchema),
  sendTestResendEmail,
);

export default router;
