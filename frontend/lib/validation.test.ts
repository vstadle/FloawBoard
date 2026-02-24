import { validateEmail, validatePassword, validateUsername, validateTitle } from './validation';

describe('User Input Validation', () => {
  describe('validateEmail', () => {
    it('should return null for valid email', () => {
      expect(validateEmail('test@example.com')).toBeNull();
      expect(validateEmail('user.name@sub.domain.co.uk')).toBeNull();
    });

    it('should return error for empty email', () => {
      expect(validateEmail('')).toBe('Email is required');
    });

    it('should return error for invalid email format', () => {
      expect(validateEmail('invalid-email')).toBe('Invalid email format');
      expect(validateEmail('user@')).toBe('Invalid email format');
      expect(validateEmail('@domain.com')).toBe('Invalid email format');
      expect(validateEmail('user@domain')).toBe('Invalid email format'); // Technically valid in some contexts but usually rejected
    });
  });

  describe('validatePassword', () => {
    it('should return null for valid password', () => {
      expect(validatePassword('Password123')).toBeNull();
    });

    it('should return error for empty password', () => {
      expect(validatePassword('')).toBe('Password is required');
    });

    it('should return error for short password', () => {
      expect(validatePassword('Pass1')).toBe('Password must be at least 8 characters long');
    });

    it('should return error for password without numbers', () => {
      expect(validatePassword('Password')).toBe('Password must contain at least one number');
    });
  });

  describe('validateUsername', () => {
    it('should return null for valid username', () => {
      expect(validateUsername('valid_user_123')).toBeNull();
    });

    it('should return error for empty username', () => {
      expect(validateUsername('')).toBe('Username is required');
    });

    it('should return error for short username', () => {
      expect(validateUsername('ab')).toBe('Username must be at least 3 characters long');
    });

    it('should return error for long username', () => {
      expect(validateUsername('a'.repeat(21))).toBe('Username must be no more than 20 characters');
    });

    it('should return error for invalid characters', () => {
      expect(validateUsername('user name')).toBe('Username can only contain letters, numbers, and underscores');
      expect(validateUsername('user@name')).toBe('Username can only contain letters, numbers, and underscores');
    });
  });

  describe('validateTitle', () => {
    it('should return null for valid title', () => {
      expect(validateTitle('My Project')).toBeNull();
    });

    it('should return error for empty title', () => {
      expect(validateTitle('')).toBe('Title is required');
      expect(validateTitle('   ')).toBe('Title is required');
    });

    it('should return error for long title', () => {
      expect(validateTitle('a'.repeat(101))).toBe('Title cannot exceed 100 characters');
    });

    it('should use custom context name', () => {
      expect(validateTitle('', 'Board name')).toBe('Board name is required');
      expect(validateTitle('a'.repeat(101), 'List title')).toBe('List title cannot exceed 100 characters');
    });
  });
});
