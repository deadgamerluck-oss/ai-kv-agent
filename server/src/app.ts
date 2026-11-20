import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes/api.routes';
import aiRoutes from './routes/ai.routes';
import voiceRoutes from './routes/voice.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { config } from './config';

export const createApp = (): Express => {
  const app = express();

  // Allowed origins list (supports comma-separated CLIENT_URL or array)
  const allowedOrigins = [
    config.clientUrl,
    'https://kvlanding.macrowdigital.com',
    'https://kvagent.macrowdigital.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean);

  // If CLIENT_URL has multiple comma-separated URLs
  if (config.clientUrl && config.clientUrl.includes(',')) {
    allowedOrigins.push(...config.clientUrl.split(',').map(s => s.trim()));
  }

  // Middleware
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.some(allowed => {
        if (!allowed) return false;
        // Exact match or match without trailing slash
        const cleanAllowed = allowed.replace(/\/$/, '');
        const cleanOrigin = origin.replace(/\/$/, '');
        return cleanAllowed === cleanOrigin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie'],
    exposedHeaders: ['Set-Cookie']
  }));
  app.use(cookieParser(config.session.cookieSecret));
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/api', apiRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/voice', voiceRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Centralized Error handler
  app.use(errorHandler);

  return app;
};
