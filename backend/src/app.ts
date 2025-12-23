import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { CONFIG, validateConfig } from './config';
import { swaggerSpec } from './config/swagger';
import logger from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import superAdminRoutes from './routes/super-admin';
import mandatorRoutes from './routes/mandator';
import tenantRoutes from './routes/tenant';

class App {
  public app: Express;

  constructor() {
    this.app = express();
    this.validateEnvironment();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private validateEnvironment(): void {
    try {
      validateConfig();
      logger.info('Environment configuration validated');
    } catch (error) {
      logger.error('Environment validation failed:', error);
      process.exit(1);
    }
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: CONFIG.CORS_ORIGIN,
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Logging
    if (CONFIG.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: {
          write: (message: string) => logger.info(message.trim()),
        },
      }));
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
      max: CONFIG.RATE_LIMIT_MAX_REQUESTS,
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(`/api/${CONFIG.API_VERSION}`, limiter);
  }

  private initializeRoutes(): void {
    const apiPrefix = `/api/${CONFIG.API_VERSION}`;

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API version info
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({ version: CONFIG.API_VERSION }); // Assuming config.api.version maps to CONFIG.API_VERSION
    });

    // Swagger documentation
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    // File upload/download routes (common)
    this.app.use('/api/v1/upload', require('./routes/common/files').default);
    this.app.use('/api/v1/files', require('./routes/common/files').default);

    // API routes
    this.app.use(`${apiPrefix}/super-admin`, superAdminRoutes);
    this.app.use(`${apiPrefix}/mandator`, mandatorRoutes);
    this.app.use(`${apiPrefix}/tenant`, tenantRoutes);

    logger.info('Routes initialized');
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public listen(): void {
    this.app.listen(CONFIG.PORT, () => {
      logger.info(`Server running on port ${CONFIG.PORT} in ${CONFIG.NODE_ENV} mode`);
      logger.info(`API Documentation available at http://localhost:${CONFIG.PORT}/api-docs`);
      logger.info(`Health check available at http://localhost:${CONFIG.PORT}/health`);
    });
  }
}

export default App;
