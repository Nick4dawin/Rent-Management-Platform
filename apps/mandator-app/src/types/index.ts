// Common types
export interface User {
  id: string;
  email: string;
  companyName: string;
  firstName: string;
  lastName: string;
}

export interface Building {
  id: string;
  mandatorId: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  yearBuilt?: number;
  hasGasHeating?: boolean;
  createdAt: string;
  updatedAt: string;
  units?: Unit[];
}

export interface Unit {
  id: string;
  buildingId: string;
  mandatorId: string;
  unitNumber: string;
  floor: number;
  area: number;
  rooms: number;
  hasWlan?: boolean;
  hasElectricity?: boolean;
  isOccupied?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  mandatorId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LeaseStatus = 'ACTIVE' | 'TERMINATED' | 'PENDING';

export interface Lease {
  id: string;
  tenantId: string;
  unitId: string;
  mandatorId: string;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  deposit: number;
  status: LeaseStatus;
  createdAt: string;
  updatedAt: string;
  tenant?: Tenant;
  unit?: Unit;
}

export type MeterType = 'WATER_COLD' | 'WATER_HOT' | 'HEAT' | 'ELECTRICITY' | 'GAS';

export interface Meter {
  id: string;
  unitId: string;
  mandatorId: string;
  type: MeterType;
  deviceId: string;
  initialReading: number;
  createdAt: string;
  updatedAt: string;
}

export interface MainMeter {
  id: string;
  buildingId: string;
  mandatorId: string;
  type: MeterType;
  deviceId: string;
  initialReading: number;
  createdAt: string;
  updatedAt: string;
}

export interface MainMeterReading {
  id: string;
  mainMeterId: string;
  reading: number;
  readingDate: string;
  notes?: string;
  createdAt: string;
}

export type SensorType = 'THERMOSTAT' | 'DOOR_WINDOW' | 'SMOKE_DETECTOR';

export interface Sensor {
  id: string;
  unitId: string;
  mandatorId: string;
  type: SensorType;
  deviceId: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MoveInProtocol {
  id: string;
  leaseId: string;
  mandatorId: string;
  moveInDate: string;
  keysReceived: number;
  meterReadings: Record<string, number>;
  roomConditions: Record<string, string>;
  notes?: string;
  isSigned: boolean;
  signedByTenant?: string;
  signedByLandlord?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MoveOutProtocol {
  id: string;
  leaseId: string;
  mandatorId: string;
  moveOutDate: string;
  keysReturned: number;
  meterReadings: Record<string, number>;
  damageAssessments: Record<string, string>;
  notes?: string;
  isSigned: boolean;
  signedByTenant?: string;
  signedByLandlord?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  mandatorId: string;
  tenantId: string;
  subject: string;
  content: string;
  isRead: boolean;
  sentAt: string;
  createdAt: string;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string;
  mandatorId: string;
  tenantId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  isRecurring: boolean;
  recurrence?: string;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
}

export interface WLANCredentials {
  id: string;
  unitId: string;
  leaseId?: string;
  mandatorId: string;
  ssid: string;
  password: string;
  validFrom: string;
  validUntil?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumptionData {
  unitId: string;
  tenantId?: string;
  meterType: MeterType;
  consumption: number;
  period: {
    from: string;
    to: string;
  };
}

export interface FinalBilling {
  id: string;
  leaseId: string;
  mandatorId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalAmount: number;
  consumptionCharges: Record<string, number>;
  otherCharges: Record<string, number>;
  notes?: string;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

// Form types
export interface BuildingFormData {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  yearBuilt?: number;
  hasGasHeating?: boolean;
}

export interface UnitFormData {
  buildingId: string;
  unitNumber: string;
  floor: number;
  area: number;
  rooms: number;
  hasWlan?: boolean;
  hasElectricity?: boolean;
}

export interface TenantFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface LeaseFormData {
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  deposit: number;
}
