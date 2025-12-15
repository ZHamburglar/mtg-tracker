import express, { Request, Response } from 'express';
import { body, query } from 'express-validator';
import { validateRequest, currentUser, requireAuth } from '@mtg-tracker/common';
import { Notification } from '../models/notification';
import { logger } from '../logger';

const router = express.Router();

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user
 */
router.get(
  '/api/notification',
  currentUser,
  requireAuth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a positive integer'),
    query('unread_only')
      .optional()
      .isBoolean()
      .withMessage('Unread_only must be a boolean'),
    query('type')
      .optional()
      .isString()
      .withMessage('Type must be a string')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const unreadOnly = req.query.unread_only === 'true';
      const type = req.query.type as string | undefined;

      const notifications = await Notification.findByUser(userId, {
        limit,
        offset,
        unreadOnly,
        ...(type && { type })
      });

      const unreadCount = await Notification.getUnreadCount(userId);

      res.status(200).json({
        notifications,
        unreadCount,
        limit,
        offset,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      res.status(500).json({
        error: 'Failed to fetch notifications',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/notifications/:id
 * Get a specific notification
 */
router.get(
  '/api/notification/:id',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const notificationId = parseInt(String(req.params.id));

      if (isNaN(notificationId)) {
        return res.status(400).json({
          error: 'Invalid notification ID'
        });
      }

      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return res.status(404).json({
          error: 'Notification not found'
        });
      }

      // Verify ownership
      if (notification.user_id !== userId) {
        return res.status(403).json({
          error: 'Not authorized to access this notification'
        });
      }

      res.status(200).json({
        notification,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching notification:', error);
      res.status(500).json({
        error: 'Failed to fetch notification',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/notifications
 * Create a new notification (authenticated endpoint)
 */
router.post(
  '/api/notification',
  currentUser,
  requireAuth,
  [
    body('user_id')
      .notEmpty()
      .withMessage('User ID is required')
      .isInt({ min: 1 })
      .withMessage('User ID must be a positive integer'),
    body('type')
      .notEmpty()
      .withMessage('Type is required')
      .isString()
      .withMessage('Type must be a string')
      .isLength({ max: 50 })
      .withMessage('Type must be 50 characters or less'),
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isString()
      .withMessage('Title must be a string')
      .isLength({ max: 255 })
      .withMessage('Title must be 255 characters or less'),
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isString()
      .withMessage('Message must be a string'),
    body('data')
      .optional()
      .isObject()
      .withMessage('Data must be an object')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { user_id, type, title, message, data } = req.body;

      const notification = await Notification.create({
        user_id,
        type,
        title,
        message,
        data: data || null
      });

      logger.log(`Notification created: ${notification.id} for user ${user_id}`);

      res.status(201).json({
        notification,
        message: 'Notification created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating notification:', error);
      res.status(500).json({
        error: 'Failed to create notification',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/notification/internal
 * Create a new notification (internal service-to-service endpoint, no auth required)
 */
router.post(
  '/api/notification/internal',
  [
    body('user_id')
      .notEmpty()
      .withMessage('User ID is required')
      .isInt({ min: 1 })
      .withMessage('User ID must be a positive integer'),
    body('type')
      .notEmpty()
      .withMessage('Type is required')
      .isString()
      .withMessage('Type must be a string')
      .isLength({ max: 50 })
      .withMessage('Type must be 50 characters or less'),
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isString()
      .withMessage('Title must be a string')
      .isLength({ max: 255 })
      .withMessage('Title must be 255 characters or less'),
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isString()
      .withMessage('Message must be a string'),
    body('data')
      .optional()
      .isObject()
      .withMessage('Data must be an object')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { user_id, type, title, message, data } = req.body;

      const notification = await Notification.create({
        user_id,
        type,
        title,
        message,
        data: data || null
      });

      logger.log(`Internal notification created: ${notification.id} for user ${user_id}`);

      res.status(201).json({
        notification,
        message: 'Notification created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating internal notification:', error);
      res.status(500).json({
        error: 'Failed to create notification',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/notifications/:id/read
 * Mark a notification as read
 */
router.post(
  '/api/notification/:id/read',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const notificationId = parseInt(String(req.params.id));

      if (isNaN(notificationId)) {
        return res.status(400).json({
          error: 'Invalid notification ID'
        });
      }

      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return res.status(404).json({
          error: 'Notification not found'
        });
      }

      // Verify ownership
      if (notification.user_id !== userId) {
        return res.status(403).json({
          error: 'Not authorized to modify this notification'
        });
      }

      await Notification.markAsRead(notificationId);

      res.status(200).json({
        message: 'Notification marked as read',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        error: 'Failed to mark notification as read',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the authenticated user
 */
router.patch(
  '/api/notification/read-all',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));

      const count = await Notification.markAllAsRead(userId);

      res.status(200).json({
        message: `${count} notifications marked as read`,
        count,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({
        error: 'Failed to mark notifications as read',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete(
  '/api/notification/:id',
  currentUser,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const notificationId = parseInt(String(req.params.id));

      if (isNaN(notificationId)) {
        return res.status(400).json({
          error: 'Invalid notification ID'
        });
      }

      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return res.status(404).json({
          error: 'Notification not found'
        });
      }

      // Verify ownership
      if (notification.user_id !== userId) {
        return res.status(403).json({
          error: 'Not authorized to delete this notification'
        });
      }

      await Notification.delete(notificationId);

      res.status(200).json({
        message: 'Notification deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({
        error: 'Failed to delete notification',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/notifications
 * Delete all notifications for the authenticated user
 */
router.delete(
  '/api/notification',
  currentUser,
  requireAuth,
  [
    query('type')
      .optional()
      .isString()
      .withMessage('Type must be a string')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(String(req.currentUser!.id));
      const type = req.query.type as string | undefined;

      const count = await Notification.deleteByUser(userId, type);

      res.status(200).json({
        message: `${count} notifications deleted`,
        count,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deleting notifications:', error);
      res.status(500).json({
        error: 'Failed to delete notifications',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export { router as notificationsRouter };
