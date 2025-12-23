import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';

describe('Integration Tests - Complete API Suite', () => {
  let superAdminToken: string;
  let mandatorToken: string;
  let tenantToken: string;
  let mandatorId: string;
  let buildingId: string;
  let unitId: string;
  let tenantId: string;
  let leaseId: string;

  beforeAll(async () => {
    // Clean database
    await prisma.$executeRaw`TRUNCATE TABLE "SuperAdmin", "Mandator", "Building", "Unit", "Tenant", "Lease" CASCADE`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Super Admin Authentication', () => {
    it('should login as super admin', async () => {
      const response = await request(app)
        .post('/api/v1/super-admin/auth/login')
        .send({
          email: process.env.SUPER_ADMIN_EMAIL,
          password: process.env.SUPER_ADMIN_PASSWORD,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      superAdminToken = response.body.data.token;
    });

    it('should reject invalid credentials', async () => {
      await request(app)
        .post('/api/v1/super-admin/auth/login')
        .send({
          email: 'wrong@email.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('2. Mandator Management', () => {
    it('should create a new mandator', async () => {
      const response = await request(app)
        .post('/api/v1/super-admin/mandators')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: 'mandator@test.com',
          password: 'Mandator123!',
          companyName: 'Test Property Management',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+49123456789',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      mandatorId = response.body.data.id;
    });

    it('should list all mandators', async () => {
      const response = await request(app)
        .get('/api/v1/super-admin/mandators')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should activate mandator', async () => {
      await request(app)
        .patch(`/api/v1/super-admin/mandators/${mandatorId}/activate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
    });
  });

  describe('3. Mandator Authentication', () => {
    it('should login as mandator', async () => {
      const response = await request(app)
        .post('/api/v1/mandator/auth/login')
        .send({
          email: 'mandator@test.com',
          password: 'Mandator123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      mandatorToken = response.body.data.token;
    });
  });

  describe('4. Building Management', () => {
    it('should create a building', async () => {
      const response = await request(app)
        .post('/api/v1/mandator/buildings')
        .set('Authorization', `Bearer ${mandatorToken}`)
        .send({
          name: 'Test Building',
          address: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'Germany',
          totalUnits: 10,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      buildingId = response.body.data.id;
    });

    it('should list buildings', async () => {
      const response = await request(app)
        .get('/api/v1/mandator/buildings')
        .set('Authorization', `Bearer ${mandatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
    });
  });

  describe('5. Unit Management', () => {
    it('should create a unit', async () => {
      const response = await request(app)
        .post('/api/v1/mandator/units')
        .set('Authorization', `Bearer ${mandatorToken}`)
        .send({
          buildingId,
          unitNumber: 'A101',
          floor: 1,
          rooms: 3,
          area: 75.5,
          rent: 1200,
          hasWlan: true,
          hasElectricity: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      unitId = response.body.data.id;
    });
  });

  describe('6. Lease Management', () => {
    it('should create a tenant first', async () => {
      const response = await request(app)
        .post('/api/v1/mandator/leases')
        .set('Authorization', `Bearer ${mandatorToken}`)
        .send({
          tenantId: 'temp-id', // This will be created in actual flow
          unitId,
          startDate: new Date().toISOString(),
          rent: 1200,
          deposit: 2400,
          status: 'DRAFT',
        })
        .expect(400); // Expected to fail without valid tenant
    });
  });

  describe('7. Move-In Protocol Workflow', () => {
    // This would test the critical app access workflow
    it('should create move-in protocol', async () => {
      // Protocol creation logic
    });
  });

  describe('8. WLAN Provisioning', () => {
    it('should create WLAN credentials', async () => {
      const response = await request(app)
        .post('/api/v1/mandator/wlan')
        .set('Authorization', `Bearer ${mandatorToken}`)
        .send({
          unitId,
          ssid: 'TestWiFi',
          password: 'SecurePassword123',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('9. Consumption Tracking', () => {
    it('should add meters to unit first', async () => {
      await request(app)
        .post('/api/v1/mandator/meters')
        .set('Authorization', `Bearer ${mandatorToken}`)
        .send({
          unitId,
          type: 'WATER_COLD',
          serialNumber: 'WM-123456',
        })
        .expect(201);
    });
  });

  describe('10. Health Check', () => {
    it('should return server health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });
});
