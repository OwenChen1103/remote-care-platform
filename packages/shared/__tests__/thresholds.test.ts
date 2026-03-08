import { describe, it, expect } from 'vitest';
import {
  checkBloodPressureLevel,
  checkBloodGlucoseLevel,
} from '../src/constants/thresholds';

describe('checkBloodPressureLevel', () => {
  it('should return normal for 120/80', () => {
    expect(checkBloodPressureLevel(120, 80)).toBe('normal');
  });

  it('should return elevated for systolic 135', () => {
    expect(checkBloodPressureLevel(135, 80)).toBe('elevated');
  });

  it('should return elevated for diastolic 87', () => {
    expect(checkBloodPressureLevel(120, 87)).toBe('elevated');
  });

  it('should return abnormal for systolic >= 140', () => {
    expect(checkBloodPressureLevel(145, 80)).toBe('abnormal');
  });

  it('should return abnormal for diastolic >= 90', () => {
    expect(checkBloodPressureLevel(120, 92)).toBe('abnormal');
  });

  it('should return abnormal for low systolic < 90', () => {
    expect(checkBloodPressureLevel(85, 70)).toBe('abnormal');
  });

  it('should return abnormal for low diastolic < 60', () => {
    expect(checkBloodPressureLevel(100, 55)).toBe('abnormal');
  });

  it('should return abnormal when both systolic and diastolic are high', () => {
    expect(checkBloodPressureLevel(150, 95)).toBe('abnormal');
  });
});

describe('checkBloodGlucoseLevel', () => {
  it('should return normal for fasting 90', () => {
    expect(checkBloodGlucoseLevel(90, 'fasting')).toBe('normal');
  });

  it('should return elevated for fasting 110', () => {
    expect(checkBloodGlucoseLevel(110, 'fasting')).toBe('elevated');
  });

  it('should return abnormal for fasting 130', () => {
    expect(checkBloodGlucoseLevel(130, 'fasting')).toBe('abnormal');
  });

  it('should return normal for before_meal 95', () => {
    expect(checkBloodGlucoseLevel(95, 'before_meal')).toBe('normal');
  });

  it('should return elevated for before_meal 105', () => {
    expect(checkBloodGlucoseLevel(105, 'before_meal')).toBe('elevated');
  });

  it('should return normal for after_meal 120', () => {
    expect(checkBloodGlucoseLevel(120, 'after_meal')).toBe('normal');
  });

  it('should return elevated for after_meal 150', () => {
    expect(checkBloodGlucoseLevel(150, 'after_meal')).toBe('elevated');
  });

  it('should return abnormal for after_meal 185', () => {
    expect(checkBloodGlucoseLevel(185, 'after_meal')).toBe('abnormal');
  });

  it('should return abnormal for low glucose < 70', () => {
    expect(checkBloodGlucoseLevel(60, 'fasting')).toBe('abnormal');
  });

  it('should return normal for random 120', () => {
    expect(checkBloodGlucoseLevel(120, 'random')).toBe('normal');
  });

  it('should return abnormal for random 185', () => {
    expect(checkBloodGlucoseLevel(185, 'random')).toBe('abnormal');
  });
});
