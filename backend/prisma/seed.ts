import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Super Admin
  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: 'admin@rentmanagement.com' },
    update: {},
    create: {
      email: 'admin@rentmanagement.com',
      password: await hashPassword('Admin123!'),
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
    },
  });
  console.log('Created Super Admin:', superAdmin.email);

  // Create Demo Mandator
  const mandator = await prisma.mandator.upsert({
    where: { contactEmail: 'demo@landlord.com' },
    update: {},
    create: {
      companyName: 'Demo Property Management GmbH',
      contactEmail: 'demo@landlord.com',
      contactPhone: '+49 123 4567890',
      address: 'Hauptstraße 123',
      city: 'Berlin',
      postalCode: '10115',
      country: 'Germany',
      adminEmail: 'admin@landlord.com',
      adminPassword: await hashPassword('Landlord123!'),
      adminFirstName: 'Max',
      adminLastName: 'Mustermann',
      isActive: true,
    },
  });
  console.log('Created Mandator:', mandator.companyName);

  // Create Building
  const building = await prisma.building.create({
    data: {
      mandatorId: mandator.id,
      name: 'Residenz am Park',
      address: 'Parkstraße 45',
      city: 'Berlin',
      postalCode: '10115',
      yearBuilt: 2015,
      hasGasHeating: true,
    },
  });
  console.log('Created Building:', building.name);

  // Create Units
  const units = await Promise.all([
    prisma.unit.create({
      data: {
        buildingId: building.id,
        mandatorId: mandator.id,
        unitNumber: '1A',
        floor: 1,
        area: 75.5,
        rooms: 3,
        hasWlan: true,
        hasElectricity: true,
      },
    }),
    prisma.unit.create({
      data: {
        buildingId: building.id,
        mandatorId: mandator.id,
        unitNumber: '2B',
        floor: 2,
        area: 85.0,
        rooms: 4,
        hasWlan: true,
        hasElectricity: true,
      },
    }),
  ]);
  console.log(`Created ${units.length} units`);

  // Create Demo Tenant
  const tenant = await prisma.tenant.create({
    data: {
      mandatorId: mandator.id,
      email: 'tenant@demo.com',
      password: await hashPassword('Tenant123!'),
      firstName: 'Anna',
      lastName: 'Schmidt',
      phone: '+49 987 6543210',
      isVerified: true,
      isActive: true,
    },
  });
  console.log('Created Tenant:', tenant.email);

  // Create Lease
  const lease = await prisma.lease.create({
    data: {
      tenantId: tenant.id,
      unitId: units[0].id,
      mandatorId: mandator.id,
      startDate: new Date('2024-01-01'),
      monthlyRent: 1200.00,
      deposit: 3600.00,
      status: 'ACTIVE',
    },
  });
  console.log('Created Lease for unit:', lease.unitId);

  // Update unit as occupied
  await prisma.unit.update({
    where: { id: units[0].id },
    data: { isOccupied: true },
  });

  // Create Consents
  await prisma.consent.createMany({
    data: [
      {
        tenantId: tenant.id,
        type: 'TERMS_AND_CONDITIONS',
        version: '1.0',
        agreed: true,
        ipAddress: '127.0.0.1',
      },
      {
        tenantId: tenant.id,
        type: 'PRIVACY_POLICY',
        version: '1.0',
        agreed: true,
        ipAddress: '127.0.0.1',
      },
    ],
  });
  console.log('Created Consents');

  // Create Sample Task
  const task = await prisma.task.create({
    data: {
      mandatorId: mandator.id,
      tenantId: tenant.id,
      title: 'Smoke Detector Check',
      description: 'Please test all smoke detectors in your unit',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      isRecurring: true,
      recurrence: 'YEARLY',
      priority: 'HIGH',
    },
  });
  console.log('Created Task:', task.title);

  console.log('\nSeeding completed successfully!\n');
  console.log('=== Demo Credentials ===');
  console.log('\nSuper Admin:');
  console.log('  Email: admin@rentmanagement.com');
  console.log('  Password: Admin123!');
  console.log('\nMandator (Landlord):');
  console.log('  Email: admin@landlord.com');
  console.log('  Password: Landlord123!');
  console.log('\nTenant:');
  console.log('  Email: tenant@demo.com');
  console.log('  Password: Tenant123!');
  console.log('========================\n');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
