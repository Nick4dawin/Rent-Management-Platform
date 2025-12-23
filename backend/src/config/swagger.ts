import swaggerJsdoc from 'swagger-jsdoc';
import { CONFIG } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Rent Management Platform API',
      version: '1.0.0',
      description: 'Multi-tenant property management platform API for Super Admin, Mandator (Landlord), and Tenant applications',
      contact: {
        name: 'API Support',
        email: 'support@rentmanagement.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${CONFIG.PORT}/api/${CONFIG.API_VERSION}`,
        description: 'Development server',
      },
      {
        url: `https://api.rentmanagement.com/api/${CONFIG.API_VERSION}`,
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            errors: {
              type: 'object',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
            },
            data: {
              type: 'object',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              example: 1,
            },
            limit: {
              type: 'number',
              example: 10,
            },
            total: {
              type: 'number',
              example: 100,
            },
            totalPages: {
              type: 'number',
              example: 10,
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Super Admin - Authentication',
        description: 'Super admin authentication endpoints',
      },
      {
        name: 'Super Admin - Mandators',
        description: 'Mandator management endpoints',
      },
      {
        name: 'Super Admin - Analytics',
        description: 'System-wide analytics and monitoring',
      },
      {
        name: 'Mandator - Authentication',
        description: 'Mandator authentication endpoints',
      },
      {
        name: 'Mandator - Buildings',
        description: 'Building management endpoints',
      },
      {
        name: 'Mandator - Units',
        description: 'Unit management endpoints',
      },
      {
        name: 'Mandator - Meters & Sensors',
        description: 'Meters and sensors management',
      },
      {
        name: 'Mandator - Tenants',
        description: 'Tenant management endpoints',
      },
      {
        name: 'Mandator - Leases',
        description: 'Lease management endpoints',
      },
      {
        name: 'Mandator - Protocols',
        description: 'Move-in/out protocol endpoints',
      },
      {
        name: 'Mandator - Communication',
        description: 'Messaging endpoints',
      },
      {
        name: 'Mandator - Tasks',
        description: 'Task management endpoints',
      },
      {
        name: 'Mandator - Billing',
        description: 'Billing management endpoints',
      },
      {
        name: 'Tenant - Authentication',
        description: 'Tenant authentication and registration',
      },
      {
        name: 'Tenant - Profile',
        description: 'Tenant profile management',
      },
      {
        name: 'Tenant - Lease',
        description: 'Tenant lease information',
      },
      {
        name: 'Tenant - Consumption',
        description: 'Consumption data viewing',
      },
      {
        name: 'Tenant - Tasks',
        description: 'Tenant task management',
      },
      {
        name: 'Tenant - Messages',
        description: 'Tenant messaging',
      },
      {
        name: 'Tenant - Alarm',
        description: 'Alarm system control',
      },
      {
        name: 'Common',
        description: 'Common endpoints (health, files)',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
