import { Firestore, collection, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebaseClient';

const MAX_BATCH_SIZE = 450;

const deleteDocumentsWhere = async (firestore: Firestore, collectionName: string, field: string, value: string) => {
  const targetQuery = query(collection(firestore, collectionName), where(field, '==', value));
  const snapshot = await getDocs(targetQuery);

  if (snapshot.empty) {
    return;
  }

  let batch = writeBatch(firestore);
  let operations = 0;

  for (const document of snapshot.docs) {
    batch.delete(document.ref);
    operations += 1;

    if (operations >= MAX_BATCH_SIZE) {
      await batch.commit();
      batch = writeBatch(firestore);
      operations = 0;
    }
  }

  if (operations > 0) {
    await batch.commit();
  }
};

export const deleteUserData = async (userId: string): Promise<void> => {
  const firestore = db;

  if (!firestore) {
    console.warn('Firestore is not configured. Skipping user data deletion.');
    return;
  }

  await Promise.all([
    deleteDocumentsWhere(firestore, 'dailyProgress', 'userId', userId),
    deleteDocumentsWhere(firestore, 'submissions', 'createdBy', userId),
    deleteDoc(doc(firestore, 'otpChallenges', userId)),
  ]);

  await deleteDoc(doc(firestore, 'users', userId));
};
