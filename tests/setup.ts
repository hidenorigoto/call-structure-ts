// Jest setup file
import { LogLevel, logger } from '../src/utils/logger';

// Suppress all logs during testing to avoid cluttering CI output
// Tests can still capture stderr/stdout through execSync
logger.setLevel(LogLevel.ERROR + 1); // Higher than ERROR to suppress all logging

// Global test timeout
jest.setTimeout(30000);
