import { ProjectLoader } from '../../src/analyzer/ProjectLoader';
import * as path from 'path';

describe('ProjectLoader Integration Tests', () => {
  let loader: ProjectLoader;

  beforeEach(() => {
    loader = new ProjectLoader();
  });

  describe('Example Projects', () => {
    it('should load simple-project example', async () => {
      const tsConfigPath = path.join(__dirname, '../../examples/simple-project/tsconfig.json');
      const project = await loader.loadProject(tsConfigPath);
      
      expect(project).toBeDefined();
      
      const sourceFiles = loader.getSourceFiles();
      expect(sourceFiles.length).toBeGreaterThan(0);
      
      // Should find main entry files
      const mainFile = loader.getSourceFile('src/index.ts');
      expect(mainFile).toBeDefined();
      
      const userServiceFile = loader.getSourceFile('src/services/UserService.ts');
      expect(userServiceFile).toBeDefined();
    });

    it('should load async-patterns example', async () => {
      const tsConfigPath = path.join(__dirname, '../../examples/async-patterns/tsconfig.json');
      const project = await loader.loadProject(tsConfigPath);
      
      expect(project).toBeDefined();
      
      const sourceFiles = loader.getSourceFiles();
      expect(sourceFiles.length).toBeGreaterThan(0);
      
      // Should find AsyncPatterns.ts
      const asyncPatternsFile = loader.getSourceFile('AsyncPatterns.ts');
      expect(asyncPatternsFile).toBeDefined();
    });

    it('should load circular-deps example', async () => {
      const tsConfigPath = path.join(__dirname, '../../examples/circular-deps/tsconfig.json');
      const project = await loader.loadProject(tsConfigPath);
      
      expect(project).toBeDefined();
      
      const sourceFiles = loader.getSourceFiles();
      expect(sourceFiles.length).toBeGreaterThan(0);
      
      // Should find both service files
      const serviceAFile = loader.getSourceFile('ServiceA.ts');
      expect(serviceAFile).toBeDefined();
      
      const serviceBFile = loader.getSourceFile('ServiceB.ts');
      expect(serviceBFile).toBeDefined();
    });
  });

  describe('tsconfig discovery', () => {
    it('should auto-discover tsconfig.json from project root', async () => {
      // When run from project root, should find the main tsconfig.json
      const originalCwd = process.cwd();
      try {
        process.chdir(path.join(__dirname, '../..'));
        
        const project = await loader.loadProject();
        expect(project).toBeDefined();
        
        const sourceFiles = loader.getSourceFiles();
        expect(sourceFiles.length).toBeGreaterThan(0);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle directory path and find tsconfig inside', async () => {
      const dirPath = path.join(__dirname, '../../examples/simple-project');
      const project = await loader.loadProject(dirPath);
      
      expect(project).toBeDefined();
      
      const tsConfigPath = loader.getTsConfigPath();
      expect(tsConfigPath).toContain('simple-project');
      expect(tsConfigPath).toContain('tsconfig.json');
    });
  });

  describe('error handling', () => {
    it('should provide clear error for non-existent path', async () => {
      const nonExistentPath = '/non/existent/path/tsconfig.json';
      
      await expect(loader.loadProject(nonExistentPath)).rejects.toThrow(
        'Path does not exist'
      );
    });

    it('should provide clear error for directory without tsconfig', async () => {
      const dirWithoutTsConfig = path.join(__dirname, '../../docs');
      
      await expect(loader.loadProject(dirWithoutTsConfig)).rejects.toThrow(
        'No tsconfig.json found in directory'
      );
    });
  });
});