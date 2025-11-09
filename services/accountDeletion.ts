import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebaseClient';

const MAX_BATCH_SIZE = 450;

const deleteDocumentsWhere = async (collectionName: string, field: string, value: string) => {
  const targetQuery = query(collection(db, collectionName), where(field, '==', value));
  const snapshot = await getDocs(targetQuery);

  if (snapshot.empty) {
    return;
  }

  let batch = writeBatch(db);
  let operations = 0;

  for (const document of snapshot.docs) {
    batch.delete(document.ref);
    operations += 1;

    if (operations >= MAX_BATCH_SIZE) {
      await batch.commit();
      batch = writeBatch(db);
      operations = 0;
    }
  }

  if (operations > 0) {
    await batch.commit();
  }
};

export const deleteUserData = async (userId: string): Promise<void> => {
  await Promise.all([
    deleteDocumentsWhere('dailyProgress', 'userId', userId),
    deleteDocumentsWhere('submissions', 'createdBy', userId),
  ]);

  await deleteDoc(doc(db, 'users', userId));
};
