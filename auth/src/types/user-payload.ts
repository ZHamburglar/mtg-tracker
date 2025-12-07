export interface UserPayload {
  id: number;
  email: string;
  username: string;
  role: 'user' | 'admin';
}
