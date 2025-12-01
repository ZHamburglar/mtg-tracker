import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

export interface UserAttrs {
  email: string;
  username?: string;
  password: string;
  role?: 'user' | 'admin';
}

export interface UserDoc {
  id: number;
  email: string;
  username?: string;
  password: string;
  is_active: boolean;
  is_verified: boolean;
  role: 'user' | 'admin';
  created_at: Date;
  updated_at: Date;
}

export class User {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    User.pool = pool;
  }

  static getPool(): mysql.Pool {
    if (!User.pool) {
      throw new Error('Database pool not initialized. Call User.setPool() first.');
    }
    return User.pool;
  }

  static async create(attrs: UserAttrs): Promise<UserDoc> {
    // Hash the password
    const hashedPassword = await bcrypt.hash(attrs.password, 10);

    // Specify columns explicitly to ensure correct order
    const [result] = await User.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO users (email, password, role, username) VALUES (?, ?, ?, ?)`,
      [attrs.email, hashedPassword, attrs.role || 'user', attrs.username || null]
    );

    const user = await User.findById(result.insertId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  static async findById(id: number): Promise<UserDoc | null> {
    const [rows] = await User.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as UserDoc;
  }

  static async findByEmail(email: string): Promise<UserDoc | null> {
    const [rows] = await User.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as UserDoc;
  }

  static async findAll(): Promise<UserDoc[]> {
    const [rows] = await User.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM users ORDER BY created_at DESC`
    );

    return rows as UserDoc[];
  }

  static async updateById(id: number, updates: Partial<UserAttrs>): Promise<UserDoc | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.email) {
      fields.push('email = ?');
      values.push(updates.email);
    }

    if (updates.username !== undefined) {
      fields.push('username = ?');
      values.push(updates.username);
    }

    if (updates.password) {
      const hashedPassword = await bcrypt.hash(updates.password, 10);
      fields.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.role) {
      fields.push('role = ?');
      values.push(updates.role);
    }

    if (fields.length === 0) {
      return User.findById(id);
    }

    values.push(id);

    await User.pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return User.findById(id);
  }

  static async deleteById(id: number): Promise<boolean> {
    const [result] = await User.pool.query<mysql.ResultSetHeader>(
      `DELETE FROM users WHERE id = ?`,
      [id]
    );

    return result.affectedRows > 0;
  }

  static async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async setVerified(id: number, verified: boolean = true): Promise<UserDoc | null> {
    await User.pool.query(
      `UPDATE users SET is_verified = ? WHERE id = ?`,
      [verified, id]
    );

    return User.findById(id);
  }

  static async setActive(id: number, active: boolean = true): Promise<UserDoc | null> {
    await User.pool.query(
      `UPDATE users SET is_active = ? WHERE id = ?`,
      [active, id]
    );

    return User.findById(id);
  }
}
