export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: User;
  };
  message?: string;
}

export interface Mandator {
  id: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  isActive: boolean;
  contractStartDate?: string;
  contractEndDate?: string;
  adminEmail?: string;
  adminFirstName?: string;
  adminLastName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateMandatorInput {
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName?: string;
  adminLastName?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Analytics {
  totalMandators: number;
  activeMandators: number;
  inactiveMandators: number;
  totalBuildings: number;
  totalUnits: number;
  totalTenants: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
