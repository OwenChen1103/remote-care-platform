import { describe, it, expect } from 'vitest';
import {
  ERROR_CODES,
  ERROR_STATUS_MAP,
  checkBloodPressureLevel,
  checkBloodGlucoseLevel,
  LoginSchema,
  RegisterSchema,
  VALID_STATUS_TRANSITIONS,
} from '../index';

describe('ERROR_CODES', () => {
  it('should have a non-empty set of error codes', () => {
    // Don't hardcode count — codes are added as new domains are introduced.
    // Just verify the registry isn't empty and every code has a HTTP status.
    expect(Object.keys(ERROR_CODES).length).toBeGreaterThan(0);
  });

  it('should have matching HTTP status for every error code', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_STATUS_MAP[code]).toBeDefined();
      expect(typeof ERROR_STATUS_MAP[code]).toBe('number');
    }
  });

  it('should include patient binding error codes (Section 1)', () => {
    expect(ERROR_CODES.PATIENT_USER_NOT_FOUND).toBe('PATIENT_USER_NOT_FOUND');
    expect(ERROR_CODES.PATIENT_USER_ROLE_MISMATCH).toBe('PATIENT_USER_ROLE_MISMATCH');
    expect(ERROR_CODES.PATIENT_USER_ALREADY_BOUND).toBe('PATIENT_USER_ALREADY_BOUND');
    expect(ERROR_STATUS_MAP.PATIENT_USER_NOT_FOUND).toBe(404);
    expect(ERROR_STATUS_MAP.PATIENT_USER_ROLE_MISMATCH).toBe(400);
    expect(ERROR_STATUS_MAP.PATIENT_USER_ALREADY_BOUND).toBe(409);
  });
});

describe('checkBloodPressureLevel', () => {
  it('should return normal for healthy BP', () => {
    expect(checkBloodPressureLevel(120, 80)).toBe('normal');
  });

  it('should return elevated for borderline BP', () => {
    expect(checkBloodPressureLevel(135, 80)).toBe('elevated');
  });

  it('should return abnormal for high BP', () => {
    expect(checkBloodPressureLevel(145, 92)).toBe('abnormal');
  });

  it('should return abnormal for low BP', () => {
    expect(checkBloodPressureLevel(85, 55)).toBe('abnormal');
  });
});

describe('checkBloodGlucoseLevel', () => {
  it('should return normal for healthy fasting BG', () => {
    expect(checkBloodGlucoseLevel(90, 'fasting')).toBe('normal');
  });

  it('should return elevated for borderline fasting BG', () => {
    expect(checkBloodGlucoseLevel(110, 'fasting')).toBe('elevated');
  });

  it('should return abnormal for high fasting BG', () => {
    expect(checkBloodGlucoseLevel(130, 'fasting')).toBe('abnormal');
  });

  it('should return abnormal for low BG', () => {
    expect(checkBloodGlucoseLevel(60, 'random')).toBe('abnormal');
  });

  it('should use after_meal thresholds correctly', () => {
    expect(checkBloodGlucoseLevel(150, 'after_meal')).toBe('elevated');
    expect(checkBloodGlucoseLevel(185, 'after_meal')).toBe('abnormal');
  });
});

describe('LoginSchema', () => {
  it('should accept valid login input', () => {
    const result = LoginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = LoginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('RegisterSchema', () => {
  it('should accept valid registration input', () => {
    const result = RegisterSchema.safeParse({
      email: 'test@example.com',
      password: 'Test1234',
      name: 'Test User',
    });
    expect(result.success).toBe(true);
  });

  it('should reject weak password (no uppercase)', () => {
    const result = RegisterSchema.safeParse({
      email: 'test@example.com',
      password: 'test1234',
      name: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const result = RegisterSchema.safeParse({
      email: 'test@example.com',
      password: 'Te1',
      name: 'Test User',
    });
    expect(result.success).toBe(false);
  });
});

describe('VALID_STATUS_TRANSITIONS', () => {
  it('should allow submitted -> screening', () => {
    expect(VALID_STATUS_TRANSITIONS.submitted).toContain('screening');
  });

  it('should allow cancellation before completion', () => {
    expect(VALID_STATUS_TRANSITIONS.submitted).toContain('cancelled');
    expect(VALID_STATUS_TRANSITIONS.screening).toContain('cancelled');
    expect(VALID_STATUS_TRANSITIONS.candidate_proposed).toContain('cancelled');
    expect(VALID_STATUS_TRANSITIONS.caregiver_confirmed).toContain('cancelled');
    expect(VALID_STATUS_TRANSITIONS.provider_confirmed).toContain('cancelled');
    expect(VALID_STATUS_TRANSITIONS.arranged).toContain('cancelled');
    expect(VALID_STATUS_TRANSITIONS.in_service).toContain('cancelled');
  });

  it('should not allow completed to transition', () => {
    expect(VALID_STATUS_TRANSITIONS.completed).toHaveLength(0);
  });
});
