# Rent Management Platform - Backend API

Production-ready Node.js + PostgreSQL backend for a multi-tenant property management platform.

## Features

- 🏢 **Multi-tenant Architecture** - Strict data isolation between landlords
- 🔐 **Authentication & Authorization** - JWT-based with role-based access control (RBAC)
- 📱 **SMS Verification** - Two-factor authentication for tenant registration
- 📊 **Comprehensive APIs** - 100+ endpoints for Super Admin, Mandator, and Tenant apps
- 📝 **Audit Logging** - GDPR-compliant activity tracking
- 📖 **Swagger Documentation** - Interactive API documentation
- ✅ **Input Validation** - Zod schema validation on all endpoints
- 🔒 **Security** - Helmet, CORS, rate limiting, password hashing (bcrypt)

## Tech Stack

- **Runtime**: Node.js (v20+)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL (v15+)
- **ORM**: Prisma
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Zod
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston

## Getting Started

### Prerequisites

- Node.js v20 or higher
- PostgreSQL v15 or higher
- npm or yarn

### Installation

1. **Clone the repository**

```bash
cd backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DATABASE_URL` - Your PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- SMS provider credentials (Twilio)
- Other configuration as needed

4. **Run database migrations**

```bash
npx prisma migrate dev
```

5. **Generate Prisma Client**

```bash
npm run prisma:generate
```

6. **Seed the database with demo data**

```bash
npm run prisma:seed
```

7. **Start the development server**

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Documentation

Once the server is running, visit:

**Swagger UI**: http://localhost:3000/api-docs

## Demo Credentials

After seeding the database, you can use these credentials:

### Super Admin
- **Email**: admin@rentmanagement.com
- **Password**: Admin123!

### Mandator (Landlord)
- **Email**: admin@landlord.com
- **Password**: Landlord123!

### Tenant
- **Email**: tenant@demo.com
- **Password**: Tenant123!

## API Endpoints Overview

### Super Admin
- `POST /api/v1/super-admin/auth/login` - Login
- `POST /api/v1/super-admin/mandators` - Create mandator
- `GET /api/v1/super-admin/mandators` - List all mandators
- `GET /api/v1/super-admin/analytics/overview` - System analytics

### Mandator (Landlord)
- `POST /api/v1/mandator/auth/login` - Login
- `POST /api/v1/mandator/buildings` - Create building
- `GET /api/v1/mandator/buildings` - List buildings
- `POST /api/v1/mandator/units` - Create unit
- `GET /api/v1/mandator/tenants` - List tenants
- `POST /api/v1/mandator/messages` - Send message to tenant
- `POST /api/v1/mandator/tasks` - Create task

### Tenant
- `POST /api/v1/tenant/auth/register` - Register with consent management
- `POST /api/v1/tenant/auth/verify-sms` - Verify SMS code
- `POST /api/v1/tenant/auth/login` - Login
- `GET /api/v1/tenant/profile` - Get profile
- `GET /api/v1/tenant/lease` - Get lease details
- `GET /api/v1/tenant/messages` - Get messages from landlord
- `GET /api/v1/tenant/tasks` - Get assigned tasks
- `POST /api/v1/tenant/tasks/:id/complete` - Complete task

## Database Schema

The database includes 24 models covering:

- Super Admin management
- Mandator (landlord) accounts
- Buildings & Units
- Meters & Sensors
- Tenants & Leases
- Move-in/Move-out Protocols
- Messages & Tasks
- Consumption tracking
- Alarm system events
- Final billing
- Audit logs

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:seed      # Seed database
```

## Security Features

- Password hashing using bcrypt
- JWT token authentication with refresh tokens
- Role-based access control (Super Admin, Mandator, Tenant)
- Multi-tenant data isolation at middleware level
- Request rate limiting
- Input validation and sanitization
- Security headers (Helmet)
- CORS configuration

## License

Proprietary - All rights reserved

## Support

For support, email support@rentmanagement.com
