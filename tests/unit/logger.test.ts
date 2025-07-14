import { Logger, LogLevel, logger } from '../../src/utils/logger';

describe('Logger', () => {
  let testLogger: Logger;
  let consoleSpy: {
    log: jest.SpyInstance;
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
    debug: jest.SpyInstance;
  };

  beforeEach(() => {
    testLogger = new Logger();
    
    // Mock all console methods
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('LogLevel enum', () => {
    it('should have correct numeric values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });
  });

  describe('Logger class', () => {
    describe('setLevel and getLevel', () => {
      it('should set and get log level', () => {
        testLogger.setLevel(LogLevel.DEBUG);
        expect(testLogger.getLevel()).toBe(LogLevel.DEBUG);

        testLogger.setLevel(LogLevel.ERROR);
        expect(testLogger.getLevel()).toBe(LogLevel.ERROR);
      });

      it('should have INFO as default level', () => {
        expect(testLogger.getLevel()).toBe(LogLevel.INFO);
      });
    });

    describe('debug method', () => {
      it('should log debug messages when level is DEBUG', () => {
        testLogger.setLevel(LogLevel.DEBUG);
        testLogger.debug('Test debug message');
        
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('[DEBUG]'),
          'Test debug message'
        );
      });

      it('should not log debug messages when level is INFO or higher', () => {
        testLogger.setLevel(LogLevel.INFO);
        testLogger.debug('Test debug message');
        expect(consoleSpy.log).not.toHaveBeenCalled();

        testLogger.setLevel(LogLevel.WARN);
        testLogger.debug('Test debug message');
        expect(consoleSpy.log).not.toHaveBeenCalled();

        testLogger.setLevel(LogLevel.ERROR);
        testLogger.debug('Test debug message');
        expect(consoleSpy.log).not.toHaveBeenCalled();
      });

      it('should handle additional arguments', () => {
        testLogger.setLevel(LogLevel.DEBUG);
        testLogger.debug('Debug with data', { key: 'value' }, 42);
        
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('[DEBUG]'),
          'Debug with data',
          { key: 'value' },
          42
        );
      });
    });

    describe('info method', () => {
      it('should log info messages when level is INFO or lower', () => {
        testLogger.setLevel(LogLevel.DEBUG);
        testLogger.info('Test info message');
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('[INFO]'),
          'Test info message'
        );

        consoleSpy.log.mockClear();
        testLogger.setLevel(LogLevel.INFO);
        testLogger.info('Test info message');
        expect(consoleSpy.log).toHaveBeenCalled();
      });

      it('should not log info messages when level is WARN or higher', () => {
        testLogger.setLevel(LogLevel.WARN);
        testLogger.info('Test info message');
        expect(consoleSpy.log).not.toHaveBeenCalled();

        testLogger.setLevel(LogLevel.ERROR);
        testLogger.info('Test info message');
        expect(consoleSpy.log).not.toHaveBeenCalled();
      });
    });

    describe('warn method', () => {
      it('should log warn messages when level is WARN or lower', () => {
        testLogger.setLevel(LogLevel.DEBUG);
        testLogger.warn('Test warn message');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('[WARN]'),
          'Test warn message'
        );

        consoleSpy.warn.mockClear();
        testLogger.setLevel(LogLevel.WARN);
        testLogger.warn('Test warn message');
        expect(consoleSpy.warn).toHaveBeenCalled();
      });

      it('should not log warn messages when level is ERROR', () => {
        testLogger.setLevel(LogLevel.ERROR);
        testLogger.warn('Test warn message');
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });
    });

    describe('error method', () => {
      it('should always log error messages at all levels', () => {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        
        levels.forEach(level => {
          consoleSpy.error.mockClear();
          testLogger.setLevel(level);
          testLogger.error('Test error message');
          
          expect(consoleSpy.error).toHaveBeenCalledWith(
            expect.stringContaining('[ERROR]'),
            'Test error message'
          );
        });
      });

      it('should handle additional arguments', () => {
        testLogger.setLevel(LogLevel.ERROR);
        const errorObj = new Error('Test error');
        testLogger.error('Error occurred', errorObj, 'extra data');
        
        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR]'),
          'Error occurred',
          errorObj,
          'extra data'
        );
      });
    });

    describe('success method', () => {
      it('should always log success messages (no level filtering)', () => {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        
        levels.forEach(level => {
          consoleSpy.log.mockClear();
          testLogger.setLevel(level);
          testLogger.success('Test success message');
          
          expect(consoleSpy.log).toHaveBeenCalledWith(
            expect.any(String), // Chalk-styled string
            'Test success message'
          );
        });
      });
    });

    describe('progress method', () => {
      it('should log progress messages when level <= INFO', () => {
        const shouldLog = [LogLevel.DEBUG, LogLevel.INFO];
        const shouldNotLog = [LogLevel.WARN, LogLevel.ERROR];
        
        // Test levels that should show progress
        shouldLog.forEach(level => {
          consoleSpy.log.mockClear();
          testLogger.setLevel(level);
          testLogger.progress('Test progress message');
          
          expect(consoleSpy.log).toHaveBeenCalledWith(
            expect.any(String), // Chalk-styled string
            'Test progress message'
          );
        });
        
        // Test levels that should not show progress
        shouldNotLog.forEach(level => {
          consoleSpy.log.mockClear();
          testLogger.setLevel(level);
          testLogger.progress('Test progress message');
          
          expect(consoleSpy.log).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('Level filtering behavior', () => {
    it('should respect log level hierarchy correctly', () => {
      // At DEBUG level, all messages should be logged
      testLogger.setLevel(LogLevel.DEBUG);
      testLogger.debug('debug');
      testLogger.info('info');
      testLogger.warn('warn');
      testLogger.error('error');
      
      expect(consoleSpy.log).toHaveBeenCalledTimes(2); // debug + info
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);

      // Reset mocks
      Object.values(consoleSpy).forEach(spy => spy.mockClear());

      // At WARN level, only warn and error should be logged
      testLogger.setLevel(LogLevel.WARN);
      testLogger.debug('debug');
      testLogger.info('info');
      testLogger.warn('warn');
      testLogger.error('error');
      
      expect(consoleSpy.log).not.toHaveBeenCalled(); // debug + info filtered out
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('Chalk integration', () => {
    it('should include log level labels in output', () => {
      testLogger.setLevel(LogLevel.DEBUG);
      
      testLogger.debug('debug message');
      testLogger.info('info message');
      testLogger.warn('warn message');
      testLogger.error('error message');
      
      // Verify that log level labels are included
      const debugCall = consoleSpy.log.mock.calls.find(call => 
        call[1] === 'debug message'
      );
      expect(debugCall?.[0]).toContain('[DEBUG]');
      
      const infoCall = consoleSpy.log.mock.calls.find(call => 
        call[1] === 'info message'
      );
      expect(infoCall?.[0]).toContain('[INFO]');
      
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('[WARN]');
      expect(consoleSpy.error.mock.calls[0][0]).toContain('[ERROR]');
    });

    it('should use chalk for styling (basic functionality test)', () => {
      // Test that chalk module is imported and usable
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const chalk = require('chalk');
      expect(chalk.red).toBeDefined();
      expect(chalk.blue).toBeDefined();
      expect(chalk.yellow).toBeDefined();
      expect(chalk.gray).toBeDefined();
    });
  });
});

describe('Singleton logger instance', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Reset logger to default state
    logger.setLevel(LogLevel.INFO);
  });

  it('should export a singleton logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.getLevel).toBeDefined();
    expect(logger.setLevel).toBeDefined();
  });

  it('should work with the singleton instance', () => {
    logger.setLevel(LogLevel.DEBUG);
    logger.debug('Test singleton debug');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG]'),
      'Test singleton debug'
    );
  });

  it('should maintain state across calls', () => {
    logger.setLevel(LogLevel.ERROR);
    expect(logger.getLevel()).toBe(LogLevel.ERROR);
    
    // State should persist
    expect(logger.getLevel()).toBe(LogLevel.ERROR);
  });
});