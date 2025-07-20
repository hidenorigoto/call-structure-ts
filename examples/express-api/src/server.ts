import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { userRouter } from './routes/users';
import { authRouter } from './routes/auth';
import { productRouter } from './routes/products';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware } from './middleware/auth';
import { rateLimiter } from './middleware/rateLimiter';
import { DatabaseService } from './services/database';
import { CacheService } from './services/cache';

// Load environment variables
dotenv.config();

export function createApp(): express.Application {
  const app = express();
  
  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  }));
  
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Logging middleware
  app.use(requestLogger);
  
  // Rate limiting
  app.use(rateLimiter);
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  // Public routes
  app.use('/api/auth', authRouter);
  
  // Protected routes
  app.use('/api/users', authMiddleware, userRouter);
  app.use('/api/products', authMiddleware, productRouter);
  
  // Error handling middleware (must be last)
  app.use(errorHandler);
  
  return app;
}

export async function startServer(): Promise<void> {
  try {
    // Initialize services
    const dbService = DatabaseService.getInstance();
    await dbService.connect();
    
    const cacheService = CacheService.getInstance();
    await cacheService.connect();
    
    // Create and configure app
    const app = createApp();
    const port = process.env.PORT || 3000;
    
    // Start server
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await dbService.disconnect();
        await cacheService.disconnect();
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}