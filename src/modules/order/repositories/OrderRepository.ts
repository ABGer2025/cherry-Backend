import { firestore } from '../../../shared/config/firebaseConfig';
import { FieldValue } from 'firebase-admin/firestore';
import { gbpToPence } from '../../../shared/utils/money';
import { Order } from '../model/Order';

const PAYMENT_RESERVATION_MS = 15 * 60 * 1000;

export class PendingOrderUnavailableError extends Error {
  constructor(reason: 'expired' | 'unavailable' | 'not_payable') {
    super(`Pending order cannot be finalized: ${reason}`);
    this.name = 'PendingOrderUnavailableError';
  }
}

const removeUndefinedValues = <T extends Record<string, unknown>>(
  value: T,
): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;

export type CreatePendingOrderInput = Pick<
  Order,
  | 'userId'
  | 'sellerId'
  | 'charityId'
  | 'email'
  | 'productAmount'
  | 'shippingFee'
  | 'securityFee'
  | 'totalAmount'
  | 'currency'
  | 'productId'
  | 'productName'
  | 'deliveryType'
  | 'shippingOptionId'
  | 'shippingOptionName'
  | 'shippingCarrier'
  | 'shippingWeight'
  | 'shipping'
  | 'pickupPoint'
>;

export class OrderRepository {
  async createPendingOrder(input: CreatePendingOrderInput): Promise<Order> {
    const orderRef = firestore.collection('orders').doc();
    const productRef = firestore.collection('products').doc(input.productId);
    const pendingOrdersQuery = firestore
      .collection('orders')
      .where('productId', '==', input.productId)
      .where('status', '==', 'pending_payment');

    return firestore.runTransaction(async (transaction) => {
      const [pendingOrders, productDoc] = await Promise.all([
        transaction.get(pendingOrdersQuery),
        transaction.get(productRef),
      ]);

      if (!productDoc.exists) {
        throw new Error('Product not found');
      }

      const productData = productDoc.data()!;
      const quantity =
        typeof productData.number === 'number' ? productData.number : 0;
      if (quantity <= 0 || productData.status !== 'active') {
        throw new Error('Product is not available');
      }

      if (
        typeof productData.price !== 'number' ||
        gbpToPence(productData.price) !== input.productAmount
      ) {
        throw new Error('Product price changed');
      }

      const now = new Date();
      let activeReservations = 0;
      pendingOrders.docs.forEach((pendingOrder) => {
        const pendingData = pendingOrder.data();
        const expiresAt = this.toDate(pendingData.paymentExpiresAt);
        if (expiresAt && expiresAt.getTime() > now.getTime()) {
          activeReservations += 1;
        } else {
          transaction.update(pendingOrder.ref, {
            status: 'expired',
            reservationActive: false,
            updatedAt: now,
          });
        }
      });

      if (quantity - activeReservations <= 0) {
        throw new Error('Product is out of stock');
      }

      const paymentExpiresAt = new Date(now.getTime() + PAYMENT_RESERVATION_MS);
      const orderData = removeUndefinedValues({
        ...input,
        paymentStatus: 'pending' as const,
        status: 'pending_payment' as const,
        shipmentStatus: 'pending' as const,
        paymentExpiresAt,
        reservationActive: true,
        createdAt: now,
        updatedAt: now,
      });

      transaction.set(orderRef, orderData);
      transaction.update(productRef, {
        checkoutReservationVersion: FieldValue.increment(1),
      });

      return {
        id: orderRef.id,
        ...orderData,
      } as Order;
    });
  }

  async attachPaymentIntent(
    orderId: string,
    paymentIntentId: string,
  ): Promise<void> {
    const orderRef = firestore.collection('orders').doc(orderId);
    await firestore.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new Error('Pending order not found');
      }

      const orderData = orderDoc.data()!;
      if (
        orderData.paymentIntentId &&
        orderData.paymentIntentId !== paymentIntentId
      ) {
        throw new Error('Pending order is already linked to another payment');
      }
      if (
        orderData.status !== 'pending_payment' &&
        orderData.paymentIntentId !== paymentIntentId
      ) {
        throw new Error('Pending order is no longer payable');
      }

      transaction.update(orderRef, {
        paymentIntentId,
        updatedAt: new Date(),
      });
    });
  }

  async releasePendingOrder(
    orderId: string,
    paymentIntentId?: string,
    cancelled = false,
  ): Promise<void> {
    const orderRef = firestore.collection('orders').doc(orderId);
    await firestore.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new Error('Pending order not found');
      }
      if (orderDoc.data()!.status !== 'pending_payment') {
        return;
      }

      const orderData = orderDoc.data()!;
      if (
        paymentIntentId &&
        orderData.paymentIntentId !== paymentIntentId
      ) {
        throw new Error('PaymentIntent does not match pending order');
      }
      const productRef = firestore
        .collection('products')
        .doc(orderData.productId);
      const productDoc = await transaction.get(productRef);

      transaction.update(orderRef, {
        status: cancelled ? 'cancelled' : 'failed',
        paymentStatus: cancelled ? 'cancelled' : 'failed',
        reservationActive: false,
        updatedAt: new Date(),
      });
      if (productDoc.exists) {
        transaction.update(productRef, {
          checkoutReservationVersion: FieldValue.increment(1),
        });
      }
    });
  }

  async finalizePendingOrder(
    orderId: string,
    paymentIntentId: string,
    userId: string,
  ): Promise<Order> {
    const orderRef = firestore.collection('orders').doc(orderId);
    const paymentLockRef = firestore
      .collection('order_payment_intents')
      .doc(paymentIntentId);

    const result = await firestore.runTransaction(async (transaction) => {
      const [orderDoc, paymentLock] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(paymentLockRef),
      ]);

      if (!orderDoc.exists) {
        throw new Error('Pending order not found');
      }

      const orderData = orderDoc.data()!;
      if (orderData.userId !== userId) {
        throw new Error('Order does not belong to the authenticated user');
      }
      if (paymentLock.exists && paymentLock.data()!.orderId === orderId) {
        if (orderData.paymentIntentId !== paymentIntentId) {
          throw new Error('Order is linked to a different payment');
        }
        return this.mapToOrder(orderId, orderData);
      }
      if (paymentLock.exists) {
        throw new Error('PaymentIntent has already been used');
      }
      if (
        orderData.paymentIntentId &&
        orderData.paymentIntentId !== paymentIntentId
      ) {
        throw new Error('PaymentIntent does not match pending order');
      }
      if (orderData.status !== 'pending_payment') {
        throw new PendingOrderUnavailableError('not_payable');
      }

      const productRef = firestore
        .collection('products')
        .doc(orderData.productId);
      const productDoc = await transaction.get(productRef);
      const paymentExpiresAt = this.toDate(orderData.paymentExpiresAt);
      if (!paymentExpiresAt || paymentExpiresAt.getTime() <= Date.now()) {
        transaction.update(orderRef, {
          status: 'expired',
          reservationActive: false,
          updatedAt: new Date(),
        });
        if (productDoc.exists) {
          transaction.update(productRef, {
            checkoutReservationVersion: FieldValue.increment(1),
          });
        }
        return 'expired' as const;
      }

      if (!productDoc.exists || orderData.reservationActive !== true) {
        transaction.update(orderRef, {
          status: 'failed',
          paymentStatus: 'failed',
          reservationActive: false,
          updatedAt: new Date(),
        });
        return 'unavailable' as const;
      }

      const productData = productDoc.data()!;
      const quantity =
        typeof productData.number === 'number' ? productData.number : 0;
      if (quantity <= 0) {
        transaction.update(orderRef, {
          status: 'failed',
          paymentStatus: 'failed',
          reservationActive: false,
          updatedAt: new Date(),
        });
        transaction.update(productRef, {
          checkoutReservationVersion: FieldValue.increment(1),
        });
        return 'unavailable' as const;
      }

      const now = new Date();
      transaction.update(orderRef, {
        paymentIntentId,
        paymentStatus: 'succeeded',
        status: 'paid',
        reservationActive: false,
        paidAt: now,
        updatedAt: now,
      });
      transaction.update(productRef, {
        number: quantity - 1,
        status:
          quantity - 1 <= 0
            ? 'sold'
            : typeof productData.status === 'string'
              ? productData.status
              : 'active',
        checkoutReservationVersion: FieldValue.increment(1),
        updatedAt: now,
      });
      transaction.set(paymentLockRef, {
        orderId,
        userId,
        createdAt: now,
      });

      return {
        id: orderId,
        ...orderData,
        paymentIntentId,
        paymentStatus: 'succeeded',
        status: 'paid',
        reservationActive: false,
        paidAt: now,
        updatedAt: now,
      } as Order;
    });

    if (result === 'expired') {
      throw new PendingOrderUnavailableError('expired');
    }
    if (result === 'unavailable') {
      throw new PendingOrderUnavailableError('unavailable');
    }
    return result;
  }

  async getOrderById(id: string): Promise<Order | null> {
    const doc = await firestore.collection('orders').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.mapToOrder(doc.id, doc.data()!);
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<void> {
    await firestore
      .collection('orders')
      .doc(id)
      .update(removeUndefinedValues(updates as Record<string, unknown>));
  }

  async getAllOrders(): Promise<Order[]> {
    const snapshot = await firestore.collection('orders').get();
    return snapshot.docs.map((doc) => this.mapToOrder(doc.id, doc.data()));
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    const snapshot = await firestore
      .collection('orders')
      .where('userId', '==', userId)
      .get();

    const orders = snapshot.docs.map((doc) =>
      this.mapToOrder(doc.id, doc.data()),
    );

    return orders.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    const snapshot = await firestore
      .collection('orders')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.mapToOrder(doc.id, doc.data()));
  }

  private mapToOrder(id: string, data: FirebaseFirestore.DocumentData): Order {
    return {
      id,
      ...data,
      createdAt: this.toDate(data.createdAt) ?? new Date(data.createdAt),
      paymentExpiresAt: this.toDate(data.paymentExpiresAt),
      paidAt: this.toDate(data.paidAt),
      buyerConfirmedReceivedAt: this.toDate(data.buyerConfirmedReceivedAt),
      sellerSoldEmailSentAt: this.toDate(data.sellerSoldEmailSentAt),
      buyerShipmentStartedEmailSentAt: this.toDate(
        data.buyerShipmentStartedEmailSentAt,
      ),
      buyerDeliveryEmailSentAt: this.toDate(data.buyerDeliveryEmailSentAt),
      buyerDisputedAt: this.toDate(data.buyerDisputedAt),
    } as Order;
  }

  private toDate(value: unknown): Date | undefined {
    if (!value) {
      return undefined;
    }

    if (typeof (value as { toDate?: unknown }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }

    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
