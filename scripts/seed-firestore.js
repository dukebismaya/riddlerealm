#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

const isoNow = () => new Date().toISOString();

const log = (message, ...rest) => {
  console.log(`[firestore:seed] ${message}`, ...rest);
};

const handleError = (error) => {
  console.error('[firestore:seed] Failed to seed Firestore.');
  console.error(error);
  process.exit(1);
};

const loadServiceAccount = async () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT to a JSON string or a path to your service account key.');
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  const resolvedPath = path.resolve(process.cwd(), trimmed);
  const fileContents = await readFile(resolvedPath, 'utf8');
  return JSON.parse(fileContents);
};

const seedUsers = async (db) => {
  const timestamp = isoNow();
  const users = [
    {
      id: 'admin-demo',
      name: 'Realm Overseer',
      email: 'admin@example.com',
      role: 'admin',
      approvalStatus: 'approved',
      score: 1200,
      streak: 15,
      badge: 'Grandmaster of Riddles',
    },
    {
      id: 'player-approved',
      name: 'Nova Solver',
      email: 'player@example.com',
      role: 'player',
      approvalStatus: 'approved',
      score: 250,
      streak: 4,
      badge: 'Clever Fox',
    },
    {
      id: 'player-pending',
      name: 'Pending Player',
      email: 'pending@example.com',
      role: 'player',
      approvalStatus: 'pending',
      score: 0,
      streak: 0,
      badge: 'New Challenger',
    },
    {
      id: 'player-denied',
      name: 'Denied Wanderer',
      email: 'denied@example.com',
      role: 'player',
      approvalStatus: 'denied',
      score: 0,
      streak: 0,
      badge: 'Locked Adventurer',
      approvalDenialReason: 'Contact the admins to appeal this decision.',
    },
  ];

  await Promise.all(
    users.map(async (user) => {
      const ref = db.collection('users').doc(user.id);
      await ref.set(
        {
          ...user,
          avatarUrl: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          approvalRequestedAt: timestamp,
          approvalUpdatedAt: user.approvalStatus === 'approved' ? timestamp : null,
          approvalDeniedAt: user.approvalStatus === 'denied' ? timestamp : null,
          approvalDenialReason: user.approvalDenialReason ?? null,
        },
        { merge: true },
      );
    }),
  );

  log(`Seeded ${users.length} user documents.`);
};

const seedDailyRiddle = async (db) => {
  const timestamp = isoNow();
  const docRef = db.collection('dailyRiddle').doc('current');
  await docRef.set(
    {
      riddleId: 'daily-seed-riddle',
      riddle: 'I speak without a mouth and hear without ears. What am I?',
      answer: 'An echo',
      difficulty: 'Medium',
      date: new Date().toISOString().split('T')[0],
      setBy: 'admin-demo',
      setByName: 'Realm Overseer',
      updatedAt: timestamp,
      createdAt: timestamp,
    },
    { merge: true },
  );
  log('Seeded daily riddle.');
};

const seedSubmissions = async (db) => {
  const timestamp = isoNow();
  const submissions = [
    {
      id: 'submission-1',
      riddle: 'What has keys but cannot open locks?',
      answer: 'A piano',
      difficulty: 'Easy',
      status: 'approved',
      createdBy: 'player-approved',
      createdByName: 'Nova Solver',
    },
    {
      id: 'submission-2',
      riddle: 'The more of me you take, the more you leave behind. What am I?',
      answer: 'Footsteps',
      difficulty: 'Medium',
      status: 'pending',
      createdBy: 'player-approved',
      createdByName: 'Nova Solver',
    },
  ];

  await Promise.all(
    submissions.map(async (submission) => {
      const ref = db.collection('submissions').doc(submission.id);
      await ref.set(
        {
          ...submission,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        { merge: true },
      );
    }),
  );

  log(`Seeded ${submissions.length} submissions.`);
};

const run = async () => {
  try {
    const serviceAccount = await loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
    const db = admin.firestore();

    await seedUsers(db);
    await seedDailyRiddle(db);
    await seedSubmissions(db);

    log('Firestore seeding complete.');
    process.exit(0);
  } catch (error) {
    handleError(error);
  }
};

await run();
