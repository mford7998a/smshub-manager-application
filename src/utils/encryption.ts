import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;
const ENCODING = 'hex';

const scryptAsync = promisify(scrypt);

export async function encrypt(text: string, password: string): Promise<string> {
  try {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = await scryptAsync(password, salt, KEY_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);
    
    const tag = cipher.getAuthTag();
    
    return [
      salt.toString(ENCODING),
      iv.toString(ENCODING), 
      tag.toString(ENCODING),
      encrypted
    ].join(':');
  } catch (error) {
    throw new Error('Encryption failed');
  }
}

export async function decrypt(encryptedData: string, password: string): Promise<string> {
  try {
    const [saltHex, ivHex, tagHex, encrypted] = encryptedData.split(':');
    
    const salt = Buffer.from(saltHex, ENCODING);
    const iv = Buffer.from(ivHex, ENCODING);
    const tag = Buffer.from(tagHex, ENCODING);
    
    const key = await scryptAsync(password, salt, KEY_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed');
  }
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64');
}

export function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString('hex');
}

export async function deriveKey(password: string, salt: string): Promise<Buffer> {
  return scryptAsync(password, Buffer.from(salt, 'hex'), KEY_LENGTH);
}

export function validatePassword(password: string): boolean {
  // Password must be at least 12 characters and contain:
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one number
  // - At least one special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{12,}$/;
  return passwordRegex.test(password);
} 