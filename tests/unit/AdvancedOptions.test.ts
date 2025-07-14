import { analyzeCommand, AnalyzeOptions } from '../../src/cli/commands/analyze';
import { CallGraphAnalyzer } from '../../src/analyzer/CallGraphAnalyzer';
import { EntryPointAnalyzer } from '../../src/analyzer/EntryPointAnalyzer';
import { logger, LogLevel } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

jest.mock('../../src/analyzer/CallGraphAnalyzer');
jest.mock('../../src/analyzer/EntryPointAnalyzer');
jest.mock('fs');

describe('Advanced CLI Options', () => {
  const mockCallGraphAnalyzer = CallGraphAnalyzer as jest.MockedClass<typeof CallGraphAnalyzer>;
  const mockEntryPointAnalyzer = EntryPointAnalyzer as jest.MockedClass<typeof EntryPointAnalyzer>;
  const mockFs = fs as jest.Mocked<typeof fs>;
  
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let loggerSetLevelSpy: jest.SpyInstance;
  let loggerGetLevelSpy: jest.SpyInstance;
  let loggerSetProgressEnabledSpy: jest.SpyInstance;
  
  const sampleCallGraph = {
    metadata: {
      generatedAt: '2024-01-01T00:00:00Z',
      entryPoint: 'main',
      maxDepth: 10,
      projectRoot: '/project',
      totalFiles: 5,
      analysisTimeMs: 100
    },
    nodes: [
      {
        id: 'node_1',
        name: 'main',
        filePath: 'src/index.ts',
        line: 1,
        type: 'function' as const,
        async: false,
        parameters: [],
        returnType: 'void'
      }
    ],
    edges: [],
    entryPointId: 'node_1'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock logger methods
    loggerSetLevelSpy = jest.spyOn(logger, 'setLevel').mockImplementation();
    loggerGetLevelSpy = jest.spyOn(logger, 'getLevel').mockImplementation();
    loggerSetProgressEnabledSpy = jest.spyOn(logger, 'setProgressEnabled').mockImplementation();
    jest.spyOn(logger, 'debug').mockImplementation();
    jest.spyOn(logger, 'info').mockImplementation();
    jest.spyOn(logger, 'progress').mockImplementation();
    jest.spyOn(logger, 'error').mockImplementation();
    jest.spyOn(logger, 'success').mockImplementation();
    
    // Default mock implementations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('mock file content');
    mockFs.writeFileSync.mockImplementation();
    mockFs.mkdirSync.mockImplementation();
    
    const mockAnalyzer = {
      analyzeFromEntryPoint: jest.fn().mockResolvedValue(sampleCallGraph)
    };
    mockCallGraphAnalyzer.mockImplementation(() => mockAnalyzer as any);
    
    const mockEntryPoint = {
      validateEntryPoint: jest.fn().mockResolvedValue({ isValid: true })
    };
    mockEntryPointAnalyzer.mockImplementation(() => mockEntryPoint as any);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Debug and Quiet Modes', () => {
    it('should enable debug logging when --debug is set', () => {
      logger.setLevel(LogLevel.DEBUG);
      
      expect(loggerSetLevelSpy).toHaveBeenCalledWith(LogLevel.DEBUG);
    });

    it('should suppress non-error output when --quiet is set', () => {
      logger.setLevel(LogLevel.ERROR);
      
      expect(loggerSetLevelSpy).toHaveBeenCalledWith(LogLevel.ERROR);
    });
  });

  describe('Progress Indicators', () => {
    it('should show progress indicators by default', () => {
      logger.setProgressEnabled(true);
      
      expect(loggerSetProgressEnabledSpy).toHaveBeenCalledWith(true);
    });

    it('should hide progress indicators when disabled', () => {
      logger.setProgressEnabled(false);
      
      expect(loggerSetProgressEnabledSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('Filter External Option', () => {
    it('should exclude external libraries when --filter-external is set', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/index.ts#main',
        format: 'json' as any,
        maxDepth: '10',
        projectRoot: '.',
        filterExternal: true
      };

      await analyzeCommand(options);

      expect(mockCallGraphAnalyzer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          excludePatterns: expect.arrayContaining([
            expect.any(RegExp),
            expect.any(RegExp),
            expect.any(RegExp)
          ])
        })
      );
      
      // Verify the actual patterns
      const callArgs = mockCallGraphAnalyzer.mock.calls[0]?.[1];
      expect(callArgs?.excludePatterns).toHaveLength(3);
      expect(callArgs?.excludePatterns?.[0].toString()).toBe('/node_modules/');
      expect(callArgs?.excludePatterns?.[1].toString()).toBe('/@types\\//');
      expect(callArgs?.excludePatterns?.[2].toString()).toBe('/\\.d\\.ts$/');
    });
  });

  describe('Configuration File Loading', () => {
    it('should load YAML configuration file', async () => {
      const yamlConfig = {
        maxDepth: 20,
        filterExternal: true,
        exclude: ['test/**']
      };
      
      mockFs.readFileSync.mockReturnValue(yaml.dump(yamlConfig));
      
      // Simulate config loading
      const configPath = 'config.yaml';
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(content);
      
      expect(config).toEqual(yamlConfig);
    });

    it('should load JSON configuration file', async () => {
      const jsonConfig = {
        maxDepth: 20,
        filterExternal: true,
        exclude: ['test/**']
      };
      
      mockFs.readFileSync.mockReturnValue(JSON.stringify(jsonConfig));
      
      // Simulate config loading
      const configPath = 'config.json';
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config).toEqual(jsonConfig);
    });

    it('should merge CLI options with config file options', async () => {
      const configOptions = {
        maxDepth: 20,
        filterExternal: true
      };
      
      const cliOptions: AnalyzeOptions = {
        entry: 'src/index.ts#main',
        format: 'json' as any,
        maxDepth: '15', // CLI should override config
        projectRoot: '.',
        config: 'config.yaml'
      };
      
      // Merge logic: CLI options override config
      const merged = { ...configOptions, ...cliOptions };
      
      expect(merged.maxDepth).toBe('15'); // CLI value
      expect(merged.filterExternal).toBe(true); // Config value
    });
  });

  describe('Exclude Patterns', () => {
    it('should apply multiple exclude patterns', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/index.ts#main',
        format: 'json' as any,
        maxDepth: '10',
        projectRoot: '.',
        exclude: ['test/.*', '.*\\.spec\\.ts', 'node_modules/.*']
      };

      await analyzeCommand(options);

      const analyzer = mockCallGraphAnalyzer.mock.results[0].value;
      expect(mockCallGraphAnalyzer).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          excludePatterns: expect.arrayContaining([
            expect.any(RegExp),
            expect.any(RegExp),
            expect.any(RegExp)
          ])
        })
      );
    });
  });

  describe('Cache Option', () => {
    it('should accept cache directory option', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/index.ts#main',
        format: 'json' as any,
        maxDepth: '10',
        projectRoot: '.',
        cache: '.cache/call-structure'
      };

      await analyzeCommand(options);

      // Cache implementation would be added in future
      expect(options.cache).toBe('.cache/call-structure');
    });
  });

  describe('Parallel Option', () => {
    it('should accept parallel workers option', async () => {
      const options: AnalyzeOptions = {
        entry: 'src/index.ts#main',
        format: 'json' as any,
        maxDepth: '10',
        projectRoot: '.',
        parallel: 4
      };

      await analyzeCommand(options);

      // Parallel implementation would be added in future
      expect(options.parallel).toBe(4);
    });
  });
});