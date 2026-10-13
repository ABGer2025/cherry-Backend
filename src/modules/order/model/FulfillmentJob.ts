export type FulfillmentJobStatus = 'pending' | 'processing' | 'completed';

export interface FulfillmentJob {
  orderId: string;
  status: FulfillmentJobStatus;
  attempts: number;
  leaseUntil?: Date;
  shipmentCompleted: boolean;
  sellerNotificationCompleted: boolean;
  buyerNotificationCompleted: boolean;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
