import { doc, getDoc, serverTimestamp, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebaseClient';
import { sendOtpEmail, EmailServiceError } from './emailService';

const OTP_COLLECTION = 'otpChallenges';
const OTP_LENGTH = 6;
const OTP_EXPIRATION_MINUTES = 5;
const MAX_ATTEMPTS = 5;

const getCrypto = (): Crypto | undefined => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as { crypto?: Crypto }).crypto) {
    return (globalThis as { crypto?: Crypto }).crypto;
  }
  return undefined;
};

const generateOtpCode = (length = OTP_LENGTH): string => {
  const cryptoObj = getCrypto();
  if (cryptoObj?.getRandomValues) {
    const randomValues = new Uint8Array(length);
    cryptoObj.getRandomValues(randomValues);
    return Array.from(randomValues, (value) => (value % 10).toString()).join('');
  }
  return Array.from({ length }, () => Math.floor(Math.random() * 10).toString()).join('');
};

const simpleHash = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
};

const hashValue = async (value: string): Promise<string> => {
  const cryptoObj = getCrypto();
  if (cryptoObj?.subtle && typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const digest = await cryptoObj.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  return simpleHash(value);
};

export type OtpErrorCode =
  | 'NO_ACTIVE_CHALLENGE'
  | 'OTP_EXPIRED'
  | 'OTP_INVALID'
  | 'OTP_MAX_ATTEMPTS'
  | 'DELIVERY_FAILED';

export class OtpError extends Error {
  public readonly code: OtpErrorCode;

  constructor(code: OtpErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'OtpError';
  }
}

const getChallengeRef = (userId: string) => doc(db, OTP_COLLECTION, userId);

export const createOtpChallenge = async (userId: string, email: string) => {
  const code = generateOtpCode();
  const hashedCode = await hashValue(code);
  const expiresAt = Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000;

  try {
    await setDoc(getChallengeRef(userId), {
      hashedCode,
      attempts: 0,
      createdAt: serverTimestamp(),
      expiresAt,
    });

    await sendOtpEmail({ toEmail: email, code, expiresInMinutes: OTP_EXPIRATION_MINUTES });
    return { expiresAt };
  } catch (error) {
    if (error instanceof EmailServiceError) {
      throw new OtpError('DELIVERY_FAILED', error.message);
    }
    throw error;
  }
};

export const clearOtpChallenge = async (userId: string) => {
  await deleteDoc(getChallengeRef(userId));
};

export const verifyOtpCode = async (userId: string, code: string) => {
  const challengeSnap = await getDoc(getChallengeRef(userId));

  if (!challengeSnap.exists()) {
    throw new OtpError('NO_ACTIVE_CHALLENGE', 'No OTP challenge found. Please request a new code.');
  }

  const data = challengeSnap.data();
  const storedHash: string | undefined = data.hashedCode;
  const attempts: number = typeof data.attempts === 'number' ? data.attempts : 0;
  const expiresAt: number = typeof data.expiresAt === 'number' ? data.expiresAt : 0;

  if (attempts >= MAX_ATTEMPTS) {
    await clearOtpChallenge(userId);
    throw new OtpError('OTP_MAX_ATTEMPTS', 'Too many incorrect attempts. Please sign in again to request a new code.');
  }

  if (expiresAt <= Date.now()) {
    await clearOtpChallenge(userId);
    throw new OtpError('OTP_EXPIRED', 'That code has expired. Please request a new one.');
  }

  const hashedAttempt = await hashValue(code);

  if (hashedAttempt !== storedHash) {
    await updateDoc(getChallengeRef(userId), {
      attempts: increment(1),
      lastFailedAt: serverTimestamp(),
    });
    throw new OtpError('OTP_INVALID', 'The code you entered is incorrect.');
  }

  await clearOtpChallenge(userId);
  return true;
};
