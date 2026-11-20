import { hash, verify } from '@node-rs/argon2';
import type { SessionUser, User } from '../models/User';
import type { UserRepository } from '../repositories/UserRepository';
import { FieldValidationError } from '../utils/errors';

/**
 * Authentication and credential management. Passwords are hashed with Argon2id
 * (memory-hard, side-channel resistant). Login verification runs in roughly
 * constant time whether or not the username exists, to avoid leaking which
 * accounts are valid.
 */
export class AuthService {
  /** Cached Argon2id hash of a random value, used to spend equivalent time on
   *  a failed username lookup so timing can't distinguish "no such user". */
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly users: UserRepository) {}

  async hashPassword(password: string): Promise<string> {
    return hash(password);
  }

  private getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = hash('argon2id-timing-equalizer-' + 'x'.repeat(24));
    }
    return this.dummyHash;
  }

  /** Returns the user on valid credentials, otherwise null. */
  async verifyCredentials(username: string, password: string): Promise<User | null> {
    const user = this.users.findByUsername(username);

    if (!user) {
      // Spend comparable time verifying against a throwaway hash, then fail.
      await verify(await this.getDummyHash(), password).catch(() => false);
      return null;
    }

    const ok = await verify(user.passwordHash, password).catch(() => false);
    if (!ok) return null;

    this.users.markLogin(user.id);
    return user;
  }

  /** Verifies the current password, then sets a new one. */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.users.findById(userId);
    if (!user) throw new FieldValidationError({ _: 'Account not found' });

    const ok = await verify(user.passwordHash, currentPassword).catch(() => false);
    if (!ok) throw new FieldValidationError({ currentPassword: 'Current password is incorrect' });

    const newHash = await this.hashPassword(newPassword);
    this.users.updatePassword(userId, newHash);
  }

  /**
   * Creates the initial admin if no users exist. Idempotent: a no-op once any
   * account is present. Used by the seed script.
   */
  async ensureInitialAdmin(username: string, password: string): Promise<boolean> {
    if (this.users.count() > 0) return false;
    const passwordHash = await this.hashPassword(password);
    this.users.create(username, passwordHash);
    return true;
  }

  /** Projects a full user down to the minimal data stored in the session. */
  toSessionUser(user: User): SessionUser {
    return { id: user.id, username: user.username };
  }
}
