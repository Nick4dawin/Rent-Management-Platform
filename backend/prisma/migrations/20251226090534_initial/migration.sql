-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('WATER_HOT', 'WATER_COLD', 'HEAT', 'ELECTRICITY', 'GAS');

-- CreateEnum
CREATE TYPE "SensorType" AS ENUM ('DOOR', 'WINDOW', 'THERMOSTAT', 'SMOKE_DETECTOR');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'SIGNED_LANDLORD', 'SIGNED_BOTH', 'ACTIVE', 'TERMINATED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_AND_CONDITIONS', 'PRIVACY_POLICY', 'DATA_PROCESSING', 'SMART_HOME');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('DRAFT', 'SIGNED_LANDLORD', 'SIGNED_BOTH', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AlarmEventType" AS ENUM ('ARMED', 'DISARMED', 'TRIGGERED', 'DOOR_OPEN', 'WINDOW_OPEN');

-- CreateTable
CREATE TABLE "super_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandators" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'Germany',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "adminPassword" TEXT NOT NULL,
    "adminFirstName" TEXT,
    "adminLastName" TEXT,

    CONSTRAINT "mandators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_audit_logs" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "yearBuilt" INTEGER,
    "hasGasHeating" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "floor" INTEGER,
    "area" DOUBLE PRECISION,
    "rooms" INTEGER,
    "hasWlan" BOOLEAN NOT NULL DEFAULT false,
    "hasElectricity" BOOLEAN NOT NULL DEFAULT false,
    "isOccupied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meters" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "type" "MeterType" NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT,
    "installDate" TIMESTAMP(3),
    "protocol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "type" "SensorType" NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT,
    "protocol" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "main_meters" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "type" "MeterType" NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "main_meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "main_meter_readings" (
    "id" TEXT NOT NULL,
    "mainMeterId" TEXT NOT NULL,
    "reading" DOUBLE PRECISION NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "main_meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "smsCode" TEXT,
    "smsCodeExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "monthlyRent" DOUBLE PRECISION NOT NULL,
    "deposit" DOUBLE PRECISION,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "landlordSignature" TEXT,
    "landlordSignedAt" TIMESTAMP(3),
    "tenantSignature" TEXT,
    "tenantSignedAt" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "terminationNotice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "move_in_protocols" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "protocolDate" TIMESTAMP(3) NOT NULL,
    "roomConditions" TEXT NOT NULL,
    "meterReadings" TEXT NOT NULL,
    "notes" TEXT,
    "landlordSignature" TEXT,
    "landlordSignedAt" TIMESTAMP(3),
    "tenantSignature" TEXT,
    "tenantSignedAt" TIMESTAMP(3),
    "status" "ProtocolStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "move_in_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "move_out_protocols" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "protocolDate" TIMESTAMP(3) NOT NULL,
    "roomConditions" TEXT NOT NULL,
    "meterReadings" TEXT NOT NULL,
    "damages" TEXT,
    "notes" TEXT,
    "landlordSignature" TEXT,
    "landlordSignedAt" TIMESTAMP(3),
    "tenantSignature" TEXT,
    "tenantSignedAt" TIMESTAMP(3),
    "status" "ProtocolStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "move_out_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wlan_credentials" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "ssid" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wlan_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumption_readings" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumption_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "tenantId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "notificationType" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "unitId" TEXT,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_events" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "tenantId" TEXT,
    "eventType" "AlarmEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "alarm_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_billings" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "rentAmount" DOUBLE PRECISION NOT NULL,
    "utilitiesAmount" DOUBLE PRECISION,
    "deductions" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "details" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "final_billings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "mandatorId" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "mandatorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mandators_contactEmail_key" ON "mandators"("contactEmail");

-- CreateIndex
CREATE INDEX "buildings_mandatorId_idx" ON "buildings"("mandatorId");

-- CreateIndex
CREATE INDEX "units_buildingId_idx" ON "units"("buildingId");

-- CreateIndex
CREATE INDEX "units_mandatorId_idx" ON "units"("mandatorId");

-- CreateIndex
CREATE UNIQUE INDEX "meters_serialNumber_key" ON "meters"("serialNumber");

-- CreateIndex
CREATE INDEX "meters_unitId_idx" ON "meters"("unitId");

-- CreateIndex
CREATE INDEX "meters_mandatorId_idx" ON "meters"("mandatorId");

-- CreateIndex
CREATE UNIQUE INDEX "sensors_serialNumber_key" ON "sensors"("serialNumber");

-- CreateIndex
CREATE INDEX "sensors_unitId_idx" ON "sensors"("unitId");

-- CreateIndex
CREATE INDEX "sensors_mandatorId_idx" ON "sensors"("mandatorId");

-- CreateIndex
CREATE UNIQUE INDEX "main_meters_serialNumber_key" ON "main_meters"("serialNumber");

-- CreateIndex
CREATE INDEX "main_meters_buildingId_idx" ON "main_meters"("buildingId");

-- CreateIndex
CREATE INDEX "main_meters_mandatorId_idx" ON "main_meters"("mandatorId");

-- CreateIndex
CREATE INDEX "main_meter_readings_mainMeterId_idx" ON "main_meter_readings"("mainMeterId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");

-- CreateIndex
CREATE INDEX "tenants_mandatorId_idx" ON "tenants"("mandatorId");

-- CreateIndex
CREATE INDEX "leases_tenantId_idx" ON "leases"("tenantId");

-- CreateIndex
CREATE INDEX "leases_unitId_idx" ON "leases"("unitId");

-- CreateIndex
CREATE INDEX "leases_mandatorId_idx" ON "leases"("mandatorId");

-- CreateIndex
CREATE INDEX "consents_tenantId_idx" ON "consents"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "move_in_protocols_leaseId_key" ON "move_in_protocols"("leaseId");

-- CreateIndex
CREATE INDEX "move_in_protocols_leaseId_idx" ON "move_in_protocols"("leaseId");

-- CreateIndex
CREATE INDEX "move_in_protocols_mandatorId_idx" ON "move_in_protocols"("mandatorId");

-- CreateIndex
CREATE UNIQUE INDEX "move_out_protocols_leaseId_key" ON "move_out_protocols"("leaseId");

-- CreateIndex
CREATE INDEX "move_out_protocols_leaseId_idx" ON "move_out_protocols"("leaseId");

-- CreateIndex
CREATE INDEX "move_out_protocols_mandatorId_idx" ON "move_out_protocols"("mandatorId");

-- CreateIndex
CREATE UNIQUE INDEX "wlan_credentials_unitId_key" ON "wlan_credentials"("unitId");

-- CreateIndex
CREATE INDEX "wlan_credentials_unitId_idx" ON "wlan_credentials"("unitId");

-- CreateIndex
CREATE INDEX "wlan_credentials_mandatorId_idx" ON "wlan_credentials"("mandatorId");

-- CreateIndex
CREATE INDEX "consumption_readings_meterId_idx" ON "consumption_readings"("meterId");

-- CreateIndex
CREATE INDEX "consumption_readings_readingDate_idx" ON "consumption_readings"("readingDate");

-- CreateIndex
CREATE INDEX "messages_mandatorId_idx" ON "messages"("mandatorId");

-- CreateIndex
CREATE INDEX "messages_tenantId_idx" ON "messages"("tenantId");

-- CreateIndex
CREATE INDEX "tasks_mandatorId_idx" ON "tasks"("mandatorId");

-- CreateIndex
CREATE INDEX "task_completions_taskId_idx" ON "task_completions"("taskId");

-- CreateIndex
CREATE INDEX "task_completions_tenantId_idx" ON "task_completions"("tenantId");

-- CreateIndex
CREATE INDEX "alarm_events_sensorId_idx" ON "alarm_events"("sensorId");

-- CreateIndex
CREATE INDEX "alarm_events_tenantId_idx" ON "alarm_events"("tenantId");

-- CreateIndex
CREATE INDEX "alarm_events_timestamp_idx" ON "alarm_events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "final_billings_leaseId_key" ON "final_billings"("leaseId");

-- CreateIndex
CREATE INDEX "final_billings_leaseId_idx" ON "final_billings"("leaseId");

-- CreateIndex
CREATE INDEX "final_billings_mandatorId_idx" ON "final_billings"("mandatorId");

-- CreateIndex
CREATE INDEX "files_mandatorId_idx" ON "files"("mandatorId");

-- CreateIndex
CREATE INDEX "audit_logs_mandatorId_idx" ON "audit_logs"("mandatorId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_mandatorId_fkey" FOREIGN KEY ("mandatorId") REFERENCES "mandators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "main_meters" ADD CONSTRAINT "main_meters_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "main_meter_readings" ADD CONSTRAINT "main_meter_readings_mainMeterId_fkey" FOREIGN KEY ("mainMeterId") REFERENCES "main_meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_mandatorId_fkey" FOREIGN KEY ("mandatorId") REFERENCES "mandators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "move_in_protocols" ADD CONSTRAINT "move_in_protocols_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "move_out_protocols" ADD CONSTRAINT "move_out_protocols_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wlan_credentials" ADD CONSTRAINT "wlan_credentials_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_readings" ADD CONSTRAINT "consumption_readings_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_mandatorId_fkey" FOREIGN KEY ("mandatorId") REFERENCES "mandators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_mandatorId_fkey" FOREIGN KEY ("mandatorId") REFERENCES "mandators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_events" ADD CONSTRAINT "alarm_events_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_events" ADD CONSTRAINT "alarm_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_billings" ADD CONSTRAINT "final_billings_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_mandatorId_fkey" FOREIGN KEY ("mandatorId") REFERENCES "mandators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
