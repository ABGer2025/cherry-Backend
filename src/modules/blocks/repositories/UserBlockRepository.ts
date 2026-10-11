import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../../shared/config/firebaseConfig';

export interface UserBlock {
  id: string;
  blockerId: string;
  blockedUserId: string;
  createdAt: Date;
}

export class UserBlockRepository {
  constructor(private readonly db = firestore) {}

  private id(blockerId: string, blockedUserId: string): string {
    return Buffer.from(JSON.stringify([blockerId, blockedUserId])).toString(
      'base64url',
    );
  }

  private legacyId(blockerId: string, blockedUserId: string): string {
    return `${encodeURIComponent(blockerId)}__${encodeURIComponent(blockedUserId)}`;
  }

  async block(blockerId: string, blockedUserId: string): Promise<UserBlock> {
    const ref = this.db.collection('user_blocks').doc(this.id(blockerId, blockedUserId));
    await ref.set(
      { blockerId, blockedUserId, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return {
      id: ref.id,
      blockerId,
      blockedUserId,
      createdAt: new Date(),
    };
  }

  async unblock(blockerId: string, blockedUserId: string): Promise<void> {
    const collection = this.db.collection('user_blocks');
    await collection.doc(this.id(blockerId, blockedUserId)).delete();
    const legacyRef = collection.doc(this.legacyId(blockerId, blockedUserId));
    const legacyDoc = await legacyRef.get();
    const legacy = legacyDoc.exists ? legacyDoc.data() : null;
    if (
      legacy?.blockerId === blockerId &&
      legacy?.blockedUserId === blockedUserId
    ) {
      await legacyRef.delete();
    }
  }

  async isBlocked(blockerId: string, blockedUserId: string): Promise<boolean> {
    const collection = this.db.collection('user_blocks');
    const doc = await collection.doc(this.id(blockerId, blockedUserId)).get();
    if (doc.exists) return true;

    const legacyDoc = await collection
      .doc(this.legacyId(blockerId, blockedUserId))
      .get();
    const legacy = legacyDoc.exists ? legacyDoc.data() : null;
    return (
      legacy?.blockerId === blockerId && legacy?.blockedUserId === blockedUserId
    );
  }

  async listBlockedUsers(blockerId: string): Promise<UserBlock[]> {
    const snapshot = await this.db
      .collection('user_blocks')
      .where('blockerId', '==', blockerId)
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        blockerId: data.blockerId,
        blockedUserId: data.blockedUserId,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : new Date(data.createdAt || 0),
      };
    });
  }

  async getBlockedUserIds(blockerId: string): Promise<Set<string>> {
    const blocks = await this.listBlockedUsers(blockerId);
    return new Set(blocks.map((block) => block.blockedUserId));
  }
}
