import { hashPassword, verifyPassword, generateAccessToken, verifyToken, generateSMSCode } from '../../src/utils/auth';

describe('Authentication Utilities', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hashed = await hashPassword(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(20);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hashed = await hashPassword(password);
      const isValid = await verifyPassword(password, hashed);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const hashed = await hashPassword(password);
      const isValid = await verifyPassword('WrongPassword', hashed);

      expect(isValid).toBe(false);
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate valid access token', () => {
      const token = generateAccessToken('user-123', 'mandator', 'mandator-456');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should verify valid token', () => {
      const token = generateAccessToken('user-123', 'mandator', 'mandator-456');
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe('user-123');
      expect(decoded.role).toBe('mandator');
      expect(decoded.mandatorId).toBe('mandator-456');
    });

    it('should reject invalid token', () => {
      expect(() => {
        verifyToken('invalid-token');
      }).toThrow();
    });
  });

  describe('SMS Code Generation', () => {
    it('should generate 6-digit SMS code', () => {
      const { code, expiresAt } = generateSMSCode();

      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
