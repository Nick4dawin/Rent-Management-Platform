# Database Schema Mapping to Business Workflow

This document explains how each database model in the Prisma schema supports the step-by-step workflow defined in the technical specification.

---

## Table of Contents

1. [Super-Admin Setup (Step 4)](#super-admin-setup-step-4)
2. [Mandator-Admin Setup (Step 5)](#mandator-admin-setup-step-5)
3. [Tenant Lifecycle (Step 6)](#tenant-lifecycle-step-6)
4. [Complete Schema Reference](#complete-schema-reference)

---

## Super-Admin Setup (Step 4)

### Step 4.1: Create New Mandator (Landlord)

**Models Used:**

#### `SuperAdmin`

```prisma
model SuperAdmin {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  firstName String?
  lastName  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  auditLogs SystemAuditLog[]
}
```

**Purpose:** Stores super admin credentials who manage the entire SaaS platform.

**Workflow Mapping:**

- Super admin logs in using `email` and `password`
- Creates mandators through the system
- All actions logged via `auditLogs` relationship

---

#### `Mandator`

```prisma
model Mandator {
  id               String   @id @default(uuid())
  companyName      String
  contactEmail     String   @unique
  contactPhone     String?
  address          String?
  city             String?
  postalCode       String?
  country          String?  @default("Germany")
  isActive         Boolean  @default(true)
  contractStartDate DateTime?
  contractEndDate   DateTime?

  // Admin credentials
  adminEmail       String
  adminPassword    String
  adminFirstName   String?
  adminLastName    String?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  buildings        Building[]
  tenants          Tenant[]
  messages         Message[]
  tasks            Task[]
  auditLogs        AuditLog[]
}
```

**Purpose:** Represents a landlord/property owner account in the multi-tenant system.

**Workflow Mapping:**

- **Step 4.1:** Super admin creates mandator with company data (`companyName`, `contactEmail`, `contactPhone`, `address`, `city`, `postalCode`)
- Admin credentials (`adminEmail`, `adminPassword`, `adminFirstName`, `adminLastName`) generated for the landlord
- `isActive` controls whether the mandator can access the system
- All related entities (buildings, tenants, messages, tasks) linked for data isolation

---

#### `SystemAuditLog`

```prisma
model SystemAuditLog {
  id             String     @id @default(uuid())
  superAdminId   String?
  action         String
  entityType     String
  entityId       String?
  details        String?    @db.Text
  ipAddress      String?
  userAgent      String?
  timestamp      DateTime   @default(now())

  superAdmin     SuperAdmin? @relation(fields: [superAdminId], references: [id])
}
```

**Purpose:** GDPR-compliant audit trail for all super admin actions.

**Workflow Mapping:**

- Logs mandator creation, activation, deactivation
- Records IP address and user agent for security
- Provides audit trail for compliance

---

## Mandator-Admin Setup (Step 5)

### Step 5.1: Create Buildings & Units

#### `Building`

```prisma
model Building {
  id           String    @id @default(uuid())
  mandatorId   String
  name         String
  address      String
  city         String
  postalCode   String
  yearBuilt    Int?
  hasGasHeating Boolean  @default(false)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  mandator     Mandator  @relation(fields: [mandatorId], references: [id], onDelete: Cascade)
  units        Unit[]
  mainMeters   MainMeter[]
}
```

**Purpose:** Stores building/property information.

**Workflow Mapping:**

- **Step 5.1:** Landlord creates buildings with `address`, `city`, `postalCode`, `yearBuilt`
- `hasGasHeating` flag determines if main gas meter is needed
- `mandatorId` ensures multi-tenant data isolation
- One-to-many relationship with `units` and `mainMeters`

---

#### `Unit`

```prisma
model Unit {
  id             String   @id @default(uuid())
  buildingId     String
  mandatorId     String
  unitNumber     String
  floor          Int?
  area           Float?
  rooms          Int?
  hasWlan        Boolean  @default(false)
  hasElectricity Boolean  @default(false)
  isOccupied     Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  building       Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)

  leases         Lease[]
  meters         Meter[]
  sensors        Sensor[]
  wlanCredentials WlanCredential?
}
```

**Purpose:** Represents individual apartments/units within a building.

**Workflow Mapping:**

- **Step 5.1:** Created per building with `unitNumber`, `floor`, `area`, `rooms`
- **Step 5.4:** `hasWlan` and `hasElectricity` flags configure unit options
- `isOccupied` tracks occupancy status
- Linked to building via `buildingId` and mandator via `mandatorId` for isolation

---

### Step 5.2: Configure Meters & Sensors per Unit

#### `Meter`

```prisma
model Meter {
  id          String   @id @default(uuid())
  unitId      String
  mandatorId  String
  type        MeterType
  serialNumber String  @unique
  manufacturer String?
  installDate  DateTime?
  protocol     String?  // wM-Bus, etc.
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  unit        Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  readings    ConsumptionReading[]
}

enum MeterType {
  WATER_HOT
  WATER_COLD
  HEAT
  ELECTRICITY
  GAS
}
```

**Purpose:** Stores individual meters assigned to units.

**Workflow Mapping:**

- **Step 5.2:** Landlord assigns water (hot/cold), heat, electricity, gas meters to units
- `type` enum covers all meter types: `WATER_HOT`, `WATER_COLD`, `HEAT`, `ELECTRICITY`, `GAS`
- `serialNumber` ensures unique identification
- `protocol` field stores "wM-Bus" for open interface compatibility
- Linked to consumption readings via `readings` relationship

---

#### `Sensor`

```prisma
model Sensor {
  id           String     @id @default(uuid())
  unitId       String
  mandatorId   String
  type         SensorType
  serialNumber String     @unique
  manufacturer String?
  protocol     String?    // ZigBee, etc.
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  unit         Unit       @relation(fields: [unitId], references: [id], onDelete: Cascade)
  alarmEvents  AlarmEvent[]
}

enum SensorType {
  DOOR
  WINDOW
  THERMOSTAT
  SMOKE_DETECTOR
}
```

**Purpose:** Stores smart home sensors/devices assigned to units.

**Workflow Mapping:**

- **Step 5.2:** Landlord assigns radiator thermostats, door/window sensors, smoke detectors
- `type` enum: `DOOR`, `WINDOW`, `THERMOSTAT`, `SMOKE_DETECTOR`
- `protocol` field stores "ZigBee" or similar for device communication
- `serialNumber` maps devices uniquely to units
- Linked to alarm events for security system

---

### Step 5.3: Main Meters

#### `MainMeter`

```prisma
model MainMeter {
  id           String   @id @default(uuid())
  buildingId   String
  mandatorId   String
  type         MeterType
  serialNumber String   @unique
  description  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  building     Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  readings     MainMeterReading[]
}
```

**Purpose:** Building-level main meters for plausibility checks.

**Workflow Mapping:**

- **Step 5.3:** Landlord creates main meters for the building
- Uses same `MeterType` enum (water, heat, electricity, gas)
- Annual readings stored in `MainMeterReading` for validation against sum of unit meters

---

#### `MainMeterReading`

```prisma
model MainMeterReading {
  id           String   @id @default(uuid())
  mainMeterId  String
  reading      Float
  readingDate  DateTime
  notes        String?
  createdAt    DateTime @default(now())

  mainMeter    MainMeter @relation(fields: [mainMeterId], references: [id], onDelete: Cascade)
}
```

**Purpose:** Historical readings for main meters.

**Workflow Mapping:**

- **Step 5.3:** Landlord enters annual readings
- Used for plausibility checks against sum of unit meter readings
- `readingDate` tracks when reading was taken

---

## Tenant Lifecycle (Step 6)

### Step 6.1: Lease Creation & Signature

#### `Tenant`

```prisma
model Tenant {
  id              String    @id @default(uuid())
  mandatorId      String
  email           String    @unique
  password        String
  firstName       String
  lastName        String
  phone           String
  isVerified      Boolean   @default(false)
  smsCode         String?
  smsCodeExpiry   DateTime?
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  mandator        Mandator  @relation(fields: [mandatorId], references: [id], onDelete: Cascade)

  leases          Lease[]
  consents        Consent[]
  messages        Message[]
  taskCompletions TaskCompletion[]
  alarmEvents     AlarmEvent[]
}
```

**Purpose:** Tenant account information.

**Workflow Mapping:**

- **Step 6.1:** Landlord creates tenant with `firstName`, `lastName`, `phone`, `email`
- **Step 6.2:** `isVerified` tracks SMS verification status
- `smsCode` and `smsCodeExpiry` for SMS verification
- `isActive` controls app access (deactivated after move-out)

---

#### `Lease`

```prisma
model Lease {
  id                String    @id @default(uuid())
  tenantId          String
  unitId            String
  mandatorId        String
  startDate         DateTime
  endDate           DateTime?
  monthlyRent       Float
  deposit           Float?
  status            LeaseStatus @default(DRAFT)
  landlordSignature String?
  landlordSignedAt  DateTime?
  tenantSignature   String?
  tenantSignedAt    DateTime?
  terminationDate   DateTime?
  terminationNotice String?   @db.Text
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  unit              Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)

  moveInProtocol    MoveInProtocol?
  moveOutProtocol   MoveOutProtocol?
  finalBilling      FinalBilling?
}

enum LeaseStatus {
  DRAFT
  SIGNED_LANDLORD
  SIGNED_BOTH
  ACTIVE
  TERMINATED
  COMPLETED
}
```

**Purpose:** Lease agreement between tenant and landlord.

**Workflow Mapping:**

- **Step 6.1:** Landlord generates lease from form data
- Stores tenant data, unit, `startDate`, `monthlyRent`, `deposit`
- **Digital signatures:** `landlordSignature` and `tenantSignature` with timestamps
- `status` tracks lease lifecycle:
  - `DRAFT` → `SIGNED_LANDLORD` → `SIGNED_BOTH` → `ACTIVE` → `TERMINATED` → `COMPLETED`
- **Step 6.8:** `terminationDate` and `terminationNotice` recorded for move-out

---

### Step 6.2: Registration (Onboarding)

#### `Consent`

```prisma
model Consent {
  id           String      @id @default(uuid())
  tenantId     String
  type         ConsentType
  version      String
  agreed       Boolean
  agreedAt     DateTime    @default(now())
  ipAddress    String?

  tenant       Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

enum ConsentType {
  TERMS_AND_CONDITIONS
  PRIVACY_POLICY
  DATA_PROCESSING
  SMART_HOME
}
```

**Purpose:** GDPR-compliant consent tracking.

**Workflow Mapping:**

- **Step 6.2:** Tenant accepts T&C and Privacy Policy during registration
- Each consent type logged separately with `version` and `agreedAt` timestamp
- `ipAddress` captured for legal compliance
- Supports: `TERMS_AND_CONDITIONS`, `PRIVACY_POLICY`, `DATA_PROCESSING`, `SMART_HOME`

---

### Step 6.3: Move-In Protocol

> **CRITICAL BUSINESS RULE:**  
> Tenant must sign the move-in protocol on the **landlord's system/tablet** BEFORE getting access to the tenant app. The `moveInProtocol.tenantSignedAt` timestamp is the trigger that enables tenant app access.

#### `MoveInProtocol`

```prisma
model MoveInProtocol {
  id                String   @id @default(uuid())
  leaseId           String   @unique
  mandatorId        String
  protocolDate      DateTime
  roomConditions    String   @db.Text // JSON data
  meterReadings     String   @db.Text // JSON data
  notes             String?  @db.Text
  landlordSignature String?
  landlordSignedAt  DateTime?
  tenantSignature   String?
  tenantSignedAt    DateTime?
  status            ProtocolStatus @default(DRAFT)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  lease             Lease    @relation(fields: [leaseId], references: [id], onDelete: Cascade)
}

enum ProtocolStatus {
  DRAFT
  SIGNED_LANDLORD
  SIGNED_BOTH
  COMPLETED
}
```

**Purpose:** Digital move-in documentation and app access control.

**Workflow Mapping:**

- **Step 6.3:** Created on handover day
- `roomConditions` (JSON) captures room-by-room condition assessment
- `meterReadings` (JSON) captures all meter readings at move-in
- **Digital signatures on landlord tablet:**
  - Landlord signs first → `landlordSignature` + `landlordSignedAt`
  - Tenant signs on landlord's device → `tenantSignature` + `tenantSignedAt`
- **APP ACCESS TRIGGER:** When `tenantSignedAt` is set and `status` = `SIGNED_BOTH`, tenant gets app access
- PDF generation triggered after both signatures
- One-to-one relationship with `Lease`

---

### Step 6.4: WLAN Provisioning

#### `WlanCredential`

```prisma
model WlanCredential {
  id          String    @id @default(uuid())
  unitId      String    @unique
  mandatorId  String
  ssid        String
  password    String
  validFrom   DateTime  @default(now())
  validUntil  DateTime?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  unit        Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)
}
```

**Purpose:** Automated WLAN credential management.

**Workflow Mapping:**

- **Step 6.4:** Created automatically after move-in protocol signature
- `validFrom` and `validUntil` linked to lease duration
- `isActive` can be toggled to immediately revoke access
- **Step 6.9:** Deactivated (`isActive` = false) after move-out

---

### Step 6.5: Operations - Consumption

#### `ConsumptionReading`

```prisma
model ConsumptionReading {
  id          String   @id @default(uuid())
  meterId     String
  value       Float
  readingDate DateTime
  source      String?  // gateway, manual, estimated
  createdAt   DateTime @default(now())

  meter       Meter    @relation(fields: [meterId], references: [id], onDelete: Cascade)
}
```

**Purpose:** Stores consumption data from meters.

**Workflow Mapping:**

- **Step 6.5:** Regular ingestion via wM-Bus gateways
- `source` tracks if reading is from gateway (automatic), manual entry, or estimated
- Linked to specific meter via `meterId`
- Time-series data indexed by `readingDate`

---

### Step 6.5: Operations - Communication

#### `Message`

```prisma
model Message {
  id             String      @id @default(uuid())
  mandatorId     String
  tenantId       String?
  subject        String
  body           String      @db.Text
  sentAt         DateTime    @default(now())
  isRead         Boolean     @default(false)
  readAt         DateTime?
  notificationType String?   // SMS, EMAIL, WHATSAPP
  notificationSent Boolean   @default(false)

  mandator       Mandator    @relation(fields: [mandatorId], references: [id], onDelete: Cascade)
  tenant         Tenant?     @relation(fields: [tenantId], references: [id], onDelete: SetNull)
}
```

**Purpose:** Communication between landlord and tenants.

**Workflow Mapping:**

- **Step 6.5:** Landlord sends messages to tenants
- **Notifications:** Tenant receives WhatsApp/SMS notification
- `notificationType` and `notificationSent` track delivery
- Message history stored with read/unread status
- Supports broadcast (null `tenantId`) or individual messages

---

### Step 6.6: Tasks & Calendar

#### `Task`

```prisma
model Task {
  id            String    @id @default(uuid())
  mandatorId    String
  unitId        String?
  tenantId      String?
  title         String
  description   String?   @db.Text
  dueDate       DateTime?
  isRecurring   Boolean   @default(false)
  recurrence    String?   // DAILY, WEEKLY, MONTHLY, YEARLY
  priority      TaskPriority @default(MEDIUM)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  mandator      Mandator  @relation(fields: [mandatorId], references: [id], onDelete: Cascade)

  completions   TaskCompletion[]
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

**Purpose:** Recurring and one-time tasks for tenants.

**Workflow Mapping:**

- **Step 6.6:** Landlord creates recurring tasks (e.g., "Smoke Detector Check")
- `isRecurring` and `recurrence` define frequency (YEARLY for smoke detectors)
- `dueDate` triggers reminders
- Priority levels help with escalation logic

---

#### `TaskCompletion`

```prisma
model TaskCompletion {
  id           String    @id @default(uuid())
  taskId       String
  tenantId     String
  completedAt  DateTime  @default(now())
  notes        String?   @db.Text
  verified     Boolean   @default(false)
  verifiedAt   DateTime?

  task         Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  tenant       Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

**Purpose:** Tracks task execution by tenants.

**Workflow Mapping:**

- **Step 6.6:** Tenant confirms task execution
- `notes` allow tenant to add comments
- `verified` flag for landlord to review completion
- Supports escalation logic: if no completion after X days, auto-reminders sent
- Multiple completions per recurring task tracked over time

---

### Step 6.7: Alarm System

#### `AlarmEvent`

```prisma
model AlarmEvent {
  id          String      @id @default(uuid())
  sensorId    String
  tenantId    String?
  eventType   AlarmEventType
  timestamp   DateTime    @default(now())
  resolved    Boolean     @default(false)
  resolvedAt  DateTime?
  notes       String?     @db.Text

  sensor      Sensor      @relation(fields: [sensorId], references: [id], onDelete: Cascade)
  tenant      Tenant?     @relation(fields: [tenantId], references: [id], onDelete: SetNull)
}

enum AlarmEventType {
  ARMED
  DISARMED
  TRIGGERED
  DOOR_OPEN
  WINDOW_OPEN
}
```

**Purpose:** Alarm system event logging.

**Workflow Mapping:**

- **Step 6.7:** Tenant arms/disarms door/window sensors
- Event types: `ARMED`, `DISARMED`, `TRIGGERED`, `DOOR_OPEN`, `WINDOW_OPEN`
- `TRIGGERED` events send immediate notifications to tenant and landlord
- All events logged with timestamp for security audit trail
- `resolved` flag tracks if issue was addressed

---

### Step 6.8: Termination & Move-Out

#### `MoveOutProtocol`

```prisma
model MoveOutProtocol {
  id                String   @id @default(uuid())
  leaseId           String   @unique
  mandatorId        String
  protocolDate      DateTime
  roomConditions    String   @db.Text // JSON data
  meterReadings     String   @db.Text // JSON data
  damages           String?  @db.Text // JSON data
  notes             String?  @db.Text
  landlordSignature String?
  landlordSignedAt  DateTime?
  tenantSignature   String?
  tenantSignedAt    DateTime?
  status            ProtocolStatus @default(DRAFT)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  lease             Lease    @relation(fields: [leaseId], references: [id], onDelete: Cascade)
}
```

**Purpose:** Digital move-out documentation.

**Workflow Mapping:**

- **Step 6.8:** Created after lease termination
- System calculates move-out date based on `lease.terminationDate`
- `roomConditions` compared against move-in protocol
- `meterReadings` captured for final billing
- `damages` documented for deposit deduction calculation
- Digital signatures by both parties
- PDF generation after signature

---

### Step 6.9: Final Billing

#### `FinalBilling`

```prisma
model FinalBilling {
  id                String   @id @default(uuid())
  leaseId           String   @unique
  mandatorId        String
  billingPeriodStart DateTime
  billingPeriodEnd   DateTime
  rentAmount        Float
  utilitiesAmount   Float?
  deductions        Float?
  totalAmount       Float
  details           String   @db.Text // JSON data with breakdown
  isPaid            Boolean  @default(false)
  paidAt            DateTime?
  generatedAt       DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  lease             Lease    @relation(fields: [leaseId], references: [id], onDelete: Cascade)
}
```

**Purpose:** Final billing after move-out.

**Workflow Mapping:**

- **Step 6.9:** Generated after move-out protocol signature
- **Phase 1:** Landlord enters details manually
- `billingPeriodStart`/`End` define calculation period
- `rentAmount` - pro-rated rent
- `utilitiesAmount` - calculated from consumption readings
- `deductions` - deposit deductions for damages
- `details` (JSON) stores transparent calculation path:
  - Meter readings from move-in and move-out
  - Allocation keys
  - Legal norm references (paragraphs cited)
- Plausibility check against main meters performed before generation
- **App Access Deactivation:** After final billing, `tenant.isActive` set to false and `wlanCredential.isActive` set to false

---

## Complete Schema Reference

### Multi-Tenant Data Isolation

All mandator-scoped tables include `mandatorId`:

| Model           | Isolation Field | Purpose                                   |
| --------------- | --------------- | ----------------------------------------- |
| Building        | `mandatorId`    | Ensure landlords see only their buildings |
| Unit            | `mandatorId`    | Enforce unit access control               |
| Meter           | `mandatorId`    | Meter data isolation                      |
| Sensor          | `mandatorId`    | Sensor data isolation                     |
| MainMeter       | `mandatorId`    | Main meter isolation                      |
| Tenant          | `mandatorId`    | Tenant belongs to specific landlord       |
| Lease           | `mandatorId`    | Lease isolation                           |
| MoveInProtocol  | `mandatorId`    | Protocol isolation                        |
| MoveOutProtocol | `mandatorId`    | Protocol isolation                        |
| WlanCredential  | `mandatorId`    | WLAN access isolation                     |
| Message         | `mandatorId`    | Communication isolation                   |
| Task            | `mandatorId`    | Task isolation                            |
| FinalBilling    | `mandatorId`    | Billing isolation                         |
| AuditLog        | `mandatorId`    | Audit trail per mandator                  |

---

## Key Relationships

### One-to-Many Relationships

```
Mandator (1) ──→ (N) Building
Building (1) ──→ (N) Unit
Building (1) ──→ (N) MainMeter
Unit (1) ──→ (N) Meter
Unit (1) ──→ (N) Sensor
Unit (1) ──→ (N) Lease
Meter (1) ──→ (N) ConsumptionReading
MainMeter (1) ──→ (N) MainMeterReading
Mandator (1) ──→ (N) Tenant
Tenant (1) ──→ (N) Lease
Tenant (1) ──→ (N) Consent
Mandator (1) ──→ (N) Message
Mandator (1) ──→ (N) Task
Task (1) ──→ (N) TaskCompletion
Sensor (1) ──→ (N) AlarmEvent
```

### One-to-One Relationships

```
Lease (1) ──→ (1) MoveInProtocol
Lease (1) ──→ (1) MoveOutProtocol
Lease (1) ──→ (1) FinalBilling
Unit (1) ──→ (1) WlanCredential
```

---

## Critical Business Rules Enforced by Schema

### 1. App Access Control Flow

```
Lease Created (DRAFT)
    ↓
Landlord Signs → Status: SIGNED_LANDLORD
    ↓
Tenant Signs Move-In Protocol on Landlord Tablet → Status: SIGNED_BOTH
    ↓
moveInProtocol.tenantSignedAt IS NOT NULL
    ↓
✅ TENANT APP ACCESS GRANTED
    ↓
Tenant Registers Account
    ↓
SMS Verification → tenant.isVerified = TRUE
    ↓
Tenant Can Login to App
```

### 2. Tenant Account Activation States

| State            | Conditions                                        | App Access        |
| ---------------- | ------------------------------------------------- | ----------------- |
| Pre-Registration | Lease created, move-in protocol unsigned          | ❌ No Access      |
| Move-In Signed   | `moveInProtocol.tenantSignedAt` exists            | ✅ Can Register   |
| Registered       | Account created, SMS verified                     | ✅ Full Access    |
| Active Lease     | `lease.status = ACTIVE`, `tenant.isActive = TRUE` | ✅ Full Access    |
| Terminated       | `lease.status = TERMINATED`                       | ✅ Limited Access |
| Moved Out        | Final billing complete, `tenant.isActive = FALSE` | ❌ No Access      |

### 3. Data Cascade Rules

When a mandator is deleted:

- All buildings, tenants, messages, tasks cascade delete
- Ensures complete data removal for GDPR compliance

When a building is deleted:

- All units, main meters cascade delete

When a unit is deleted:

- All meters, sensors, leases cascade delete

When a lease is deleted:

- Move-in protocol, move-out protocol, final billing cascade delete

---

## Index Strategy for Performance

### Multi-Tenant Queries

```sql
-- All mandator-scoped tables indexed on mandatorId
CREATE INDEX idx_building_mandator ON Building(mandatorId);
CREATE INDEX idx_unit_mandator ON Unit(mandatorId);
CREATE INDEX idx_tenant_mandator ON Tenant(mandatorId);
-- etc.
```

### Foreign Key Relationships

```sql
CREATE INDEX idx_unit_building ON Unit(buildingId);
CREATE INDEX idx_meter_unit ON Meter(unitId);
CREATE INDEX idx_lease_tenant ON Lease(tenantId);
CREATE INDEX idx_lease_unit ON Lease(unitId);
-- etc.
```

### Time-Series Data

```sql
CREATE INDEX idx_consumption_date ON ConsumptionReading(readingDate);
CREATE INDEX idx_alarm_timestamp ON AlarmEvent(timestamp);
CREATE INDEX idx_audit_timestamp ON AuditLog(timestamp);
```

---

## Summary

The database schema is designed to:

1. **Enforce Multi-Tenancy:** Every mandator-scoped entity includes `mandatorId` for strict data isolation
2. **Support Complete Workflow:** Each workflow step has corresponding models and relationships
3. **Enable GDPR Compliance:** Consent tracking, audit logs, cascade deletes
4. **Control App Access:** Move-in protocol signature triggers tenant app registration
5. **Track Lifecycle:** Lease status, protocol signatures, task completions all tracked
6. **Support Future Automation:** Meter readings, sensors, WLAN credentials ready for API integration
7. **Ensure Legal Compliance:** Final billing with transparent calculations and norm citations

All 24 models work together to digitally map the entire tenant lifecycle from lease signing to move-out and final billing, with audit-proof traceability at every step.
