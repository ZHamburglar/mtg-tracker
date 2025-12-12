import mysql from 'mysql2/promise';
import { logger } from '../logger';

export interface NotificationAttrs {
  user_id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
}

export interface NotificationDoc {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationQueryOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  type?: string;
}

export class Notification {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    Notification.pool = pool;
  }

  static getPool(): mysql.Pool {
    if (!Notification.pool) {
      throw new Error('Database pool not initialized. Call Notification.setPool() first.');
    }
    return Notification.pool;
  }

  /**
   * Create a new notification
   */
  static async create(attrs: NotificationAttrs): Promise<NotificationDoc> {
    const [result] = await Notification.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)`,
      [attrs.user_id, attrs.type, attrs.title, attrs.message, JSON.stringify(attrs.data || null)]
    );

    const notification = await Notification.findById(result.insertId);
    if (!notification) {
      logger.error('Failed to retrieve notification after creation:', { insertId: result.insertId });
      throw new Error('Failed to create notification');
    }

    return notification;
  }

  /**
   * Find a notification by ID
   */
  static async findById(id: number): Promise<NotificationDoc | null> {
    const [rows] = await Notification.pool.query<mysql.RowDataPacket[]>(
      `SELECT id, user_id, type, title, message, data, \`read\`, created_at, updated_at 
       FROM notifications 
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    const notification = rows[0] as NotificationDoc;
    // Parse JSON data if it exists
    if (notification.data && typeof notification.data === 'string') {
      try {
        notification.data = JSON.parse(notification.data);
      } catch (error) {
        logger.error('Failed to parse notification data:', error);
        notification.data = null;
      }
    }

    return notification;
  }

  /**
   * Find notifications by user ID with optional filters
   */
  static async findByUser(
    userId: number,
    options: NotificationQueryOptions = {}
  ): Promise<NotificationDoc[]> {
    const { limit = 20, offset = 0, unreadOnly = false, type } = options;

    let query = `
      SELECT id, user_id, type, title, message, data, \`read\`, created_at, updated_at 
      FROM notifications 
      WHERE user_id = ?
    `;
    const params: any[] = [userId];

    if (unreadOnly) {
      query += ` AND \`read\` = false`;
    }

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await Notification.pool.query<mysql.RowDataPacket[]>(query, params);

    return (rows as NotificationDoc[]).map(notification => {
      // Parse JSON data if it exists
      if (notification.data && typeof notification.data === 'string') {
        try {
          notification.data = JSON.parse(notification.data);
        } catch (error) {
          logger.error('Failed to parse notification data:', error);
          notification.data = null;
        }
      }
      return notification;
    });
  }

  /**
   * Get count of unread notifications for a user
   */
  static async getUnreadCount(userId: number): Promise<number> {
    const [rows] = await Notification.pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND \`read\` = false`,
      [userId]
    );

    return rows[0]?.count || 0;
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(id: number): Promise<void> {
    await Notification.pool.query(
      `UPDATE notifications SET \`read\` = true, updated_at = NOW() WHERE id = ?`,
      [id]
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: number): Promise<number> {
    const [result] = await Notification.pool.query<mysql.ResultSetHeader>(
      `UPDATE notifications SET \`read\` = true, updated_at = NOW() WHERE user_id = ? AND \`read\` = false`,
      [userId]
    );

    return result.affectedRows;
  }

  /**
   * Delete a notification
   */
  static async delete(id: number): Promise<void> {
    await Notification.pool.query(
      `DELETE FROM notifications WHERE id = ?`,
      [id]
    );
  }

  /**
   * Delete notifications by user ID with optional type filter
   */
  static async deleteByUser(userId: number, type?: string): Promise<number> {
    let query = `DELETE FROM notifications WHERE user_id = ?`;
    const params: any[] = [userId];

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    const [result] = await Notification.pool.query<mysql.ResultSetHeader>(query, params);

    return result.affectedRows;
  }

  /**
   * Delete old read notifications (cleanup utility)
   */
  static async deleteOldReadNotifications(daysOld: number = 30): Promise<number> {
    const [result] = await Notification.pool.query<mysql.ResultSetHeader>(
      `DELETE FROM notifications WHERE \`read\` = true AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [daysOld]
    );

    return result.affectedRows;
  }

  /**
   * Get all notifications (admin function)
   */
  static async findAll(limit: number = 100, offset: number = 0): Promise<NotificationDoc[]> {
    const [rows] = await Notification.pool.query<mysql.RowDataPacket[]>(
      `SELECT id, user_id, type, title, message, data, \`read\`, created_at, updated_at 
       FROM notifications 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return (rows as NotificationDoc[]).map(notification => {
      // Parse JSON data if it exists
      if (notification.data && typeof notification.data === 'string') {
        try {
          notification.data = JSON.parse(notification.data);
        } catch (error) {
          logger.error('Failed to parse notification data:', error);
          notification.data = null;
        }
      }
      return notification;
    });
  }
}
