// Jest setup file
import { LogLevel, logger } from '../src/utils/logger';

// Suppress logs during testing unless explicitly needed
logger.setLevel(LogLevel.ERROR);

// Global test timeout
jest.setTimeout(30000);