import { describe, it, expect } from 'vitest';
import { RegisterSchema } from '../src/schemas/auth';

describe('RegisterSchema', () => {
  it('should accept valid registration without role (defaults to caregiver)', () => {
    const result = RegisterSchema.safeParse({
      email: 'test@example.com',
      password: 'Test1234',
      name: '測試',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('caregiver');
    }
  });

  it('should accept role=patient', () => {
    const result = RegisterSchema.safeParse({
      email: 'test@example.com',
      password: 'Test1234',
      name: '測試',
      role: 'patient',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('patient');
    }
  });

  it('should accept role=provider', () => {
    const result = RegisterSchema.safeParse({
      email: 'test@example.com',
      password: 'Test1234',
      name: '測試',
      role: 'provider',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('provider');
    }
  });

  it('should reject role=admin', () => {
    const result = RegisterSchema.safeParse({
      email: 'test@example.com',
      password: 'Test1234',
      name: '測試',
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const result = RegisterSchema.safeParse({
      email: 'test@example.com',
      password: 'Test1234',
      name: '測試',
      role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });
});
