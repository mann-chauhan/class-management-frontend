export interface AdminPasswordReset {
  adminId: number;
  userId: number;
  organizationName: string;
  username: string;
  temporaryPassword: string;
}
