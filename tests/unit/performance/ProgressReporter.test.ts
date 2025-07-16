import { ProgressReporter } from '../../../src/performance/ProgressReporter';
import * as ora from 'ora';

jest.mock('ora');

describe('ProgressReporter', () => {
  let mockSpinner: any;
  let progressReporter: ProgressReporter;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
      info: jest.fn().mockReturnThis(),
      warn: jest.fn().mockReturnThis(),
      stop: jest.fn().mockReturnThis(),
      text: '',
    };

    (ora as any).mockReturnValue(mockSpinner);
  });

  describe('factory methods', () => {
    it('should create file analysis reporter', () => {
      progressReporter = ProgressReporter.forFileAnalysis();

      expect(progressReporter).toBeDefined();
      progressReporter.start();

      expect(ora).toHaveBeenCalledWith({
        text: 'Starting analysis...',
        spinner: 'dots',
        color: 'cyan',
      });
    });

    it('should not create spinner in silent mode', () => {
      progressReporter = ProgressReporter.forFileAnalysis({ silent: true });
      progressReporter.start();

      expect(ora).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    beforeEach(() => {
      progressReporter = ProgressReporter.forFileAnalysis();
    });

    it('should start spinner with custom text', () => {
      progressReporter.start('Custom message');

      expect(mockSpinner.start).toHaveBeenCalled();
      expect(ora).toHaveBeenCalledWith({
        text: 'Custom message',
        spinner: 'dots',
        color: 'cyan',
      });
    });

    it('should start spinner without custom text', () => {
      progressReporter.start();

      expect(mockSpinner.start).toHaveBeenCalled();
    });

    it('should not start spinner in silent mode', () => {
      progressReporter = ProgressReporter.forFileAnalysis({ silent: true });
      progressReporter.start('Test');

      expect(ora).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      progressReporter = ProgressReporter.forFileAnalysis();
    });

    it('should update spinner text with progress info', () => {
      progressReporter.start();
      const progressInfo = {
        total: 10,
        completed: 5,
        current: 'file.ts',
        percentage: 50,
      };
      progressReporter.update(progressInfo);

      expect(mockSpinner.text).toContain('5/10');
      expect(mockSpinner.text).toContain('50.0%');
    });

    it('should not update in silent mode', () => {
      progressReporter = ProgressReporter.forFileAnalysis({ silent: true });
      const progressInfo = {
        total: 10,
        completed: 5,
        current: 'file.ts',
        percentage: 50,
      };
      progressReporter.update(progressInfo);

      expect(ora).not.toHaveBeenCalled();
    });
  });

  describe('success', () => {
    beforeEach(() => {
      progressReporter = ProgressReporter.forFileAnalysis();
    });

    it('should mark spinner as succeeded', () => {
      progressReporter.start();
      progressReporter.success('Done!');

      expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining('Done!'));
    });

    it('should use default message if not provided', () => {
      progressReporter.start();
      progressReporter.success();

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('Analysis completed')
      );
    });
  });

  describe('fail', () => {
    beforeEach(() => {
      progressReporter = ProgressReporter.forFileAnalysis();
    });

    it('should mark spinner as failed with error message', () => {
      progressReporter.start();
      const error = new Error('Test error');
      progressReporter.fail(error);

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    });

    it('should handle string errors', () => {
      progressReporter.start();
      progressReporter.fail('String error');

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('String error'));
    });
  });

  describe('info', () => {
    beforeEach(() => {
      progressReporter = ProgressReporter.forFileAnalysis();
    });

    it('should show info message', () => {
      progressReporter.start();
      progressReporter.info('Information');

      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(ora).toHaveBeenCalledTimes(2); // Initial start + restart after info
    });
  });

  describe('warn', () => {
    beforeEach(() => {
      progressReporter = ProgressReporter.forFileAnalysis();
    });

    it('should show warning message', () => {
      progressReporter.start();
      progressReporter.warn('Warning');

      expect(mockSpinner.warn).toHaveBeenCalledWith(expect.stringContaining('Warning'));
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      progressReporter = ProgressReporter.forFileAnalysis();
    });

    it('should stop spinner', () => {
      progressReporter.start();
      progressReporter.stop();

      expect(mockSpinner.stop).toHaveBeenCalled();
    });

    it('should not fail if spinner does not exist', () => {
      progressReporter = ProgressReporter.forFileAnalysis({ silent: true });

      expect(() => progressReporter.stop()).not.toThrow();
    });
  });
});
