export interface School {
  id: number;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolOption {
  id: number;
  name: string;
  code: string;
}

export interface CreateSchoolRequest {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface UpdateSchoolRequest {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}
