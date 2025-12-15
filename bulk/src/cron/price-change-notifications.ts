import mysql from 'mysql2/promise';
import axios from 'axios';
import { logger } from '../logger';

interface PriceChangeCard {
  user_id: number;
  card_id: string;
  card_name: string;
  current_price: number;
  old_price: number;
  price_change_percent: number;
  quantity: number;
  finish_type: string;
}

export async function checkPriceChangesAndNotify(pool: mysql.Pool) {
  try {
    logger.log('Starting price change notification check...');
    
    // Get cards from user collections with their current and week-old prices
    const query = `
      SELECT 
        ucc.user_id,
        ucc.card_id,
        c.name as card_name,
        ucc.quantity,
        ucc.finish_type,
        CASE 
          WHEN ucc.finish_type = 'foil' THEN cp_current.price_usd_foil
          WHEN ucc.finish_type = 'etched' THEN cp_current.price_usd_etched
          ELSE cp_current.price_usd
        END as current_price,
        CASE 
          WHEN ucc.finish_type = 'foil' THEN cp_week_ago.price_usd_foil
          WHEN ucc.finish_type = 'etched' THEN cp_week_ago.price_usd_etched
          ELSE cp_week_ago.price_usd
        END as old_price
      FROM user_card_collection ucc
      INNER JOIN cards c ON ucc.card_id = c.id
      INNER JOIN (
        SELECT card_id, price_usd, price_usd_foil, price_usd_etched
        FROM card_prices
        WHERE (card_id, created_at) IN (
          SELECT card_id, MAX(created_at)
          FROM card_prices
          GROUP BY card_id
        )
      ) cp_current ON ucc.card_id = cp_current.card_id
      INNER JOIN (
        SELECT card_id, price_usd, price_usd_foil, price_usd_etched
        FROM card_prices
        WHERE (card_id, created_at) IN (
          SELECT card_id, MAX(created_at)
          FROM card_prices
          WHERE created_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY card_id
        )
      ) cp_week_ago ON ucc.card_id = cp_week_ago.card_id
      WHERE ucc.quantity > 0
      HAVING current_price > 0 
        AND old_price > 0
        AND ((current_price - old_price) / old_price * 100) >= 10
      ORDER BY ucc.user_id, ((current_price - old_price) / old_price * 100) DESC
    `;

    const [rows] = await pool.query<mysql.RowDataPacket[]>(query);
    
    if (rows.length === 0) {
      logger.log('No cards with 10%+ price increases found');
      return;
    }

    logger.log(`Found ${rows.length} cards with 10%+ price increases`);

    // Group by user_id
    const userCards = new Map<number, PriceChangeCard[]>();
    for (const row of rows) {
      const card: PriceChangeCard = {
        user_id: row.user_id,
        card_id: row.card_id,
        card_name: row.card_name,
        current_price: parseFloat(row.current_price),
        old_price: parseFloat(row.old_price),
        price_change_percent: ((parseFloat(row.current_price) - parseFloat(row.old_price)) / parseFloat(row.old_price)) * 100,
        quantity: row.quantity,
        finish_type: row.finish_type
      };

      if (!userCards.has(card.user_id)) {
        userCards.set(card.user_id, []);
      }
      userCards.get(card.user_id)!.push(card);
    }

    // Create notifications for each user
    let notificationsCreated = 0;
    for (const [userId, cards] of userCards.entries()) {
      try {
        // Create a summary notification if user has multiple cards with price increases
        if (cards.length > 1) {
          const topCards = cards.slice(0, 3); // Top 3 gainers
          const cardNames = topCards.map(c => c.card_name).join(', ');
          const avgIncrease = cards.reduce((sum, c) => sum + c.price_change_percent, 0) / cards.length;
          
          const message = `${cards.length} cards in your collection increased by 10% or more. Top gainers: ${cardNames}`;
          
          await createNotification({
            user_id: userId,
            type: 'price_alert',
            title: `${cards.length} Cards Price Alert`,
            message,
            data: {
              total_cards: cards.length,
              avg_increase: avgIncrease.toFixed(1),
              top_cards: topCards.map(c => ({
                card_id: c.card_id,
                card_name: c.card_name,
                price_change_percent: c.price_change_percent.toFixed(1),
                current_price: c.current_price,
                quantity: c.quantity
              }))
            }
          });
          notificationsCreated++;
        } else {
          // Single card notification
          const card = cards[0];
          if (!card) {
            logger.error(`No card found for user ${userId}`);
            continue;
          }
          
          const priceChange = card.current_price - card.old_price;
          
          const message = `${card.card_name} (${card.finish_type}) increased ${card.price_change_percent.toFixed(1)}% ($${card.old_price.toFixed(2)} → $${card.current_price.toFixed(2)})`;
          
          await createNotification({
            user_id: userId,
            type: 'price_alert',
            title: 'Card Price Alert',
            message,
            data: {
              card_id: card.card_id,
              card_name: card.card_name,
              finish_type: card.finish_type,
              old_price: card.old_price,
              current_price: card.current_price,
              price_change: priceChange,
              price_change_percent: card.price_change_percent.toFixed(1),
              quantity: card.quantity
            }
          });
          notificationsCreated++;
        }
      } catch (error) {
        logger.error(`Error creating notification for user ${userId}:`, error);
      }
    }

    logger.log(`Price change notifications created: ${notificationsCreated} for ${userCards.size} users`);
  } catch (error) {
    logger.error('Error checking price changes:', error);
  }
}

async function createNotification(notification: {
  user_id: number;
  type: string;
  title: string;
  message: string;
  data: any;
}) {
  try {
    // Call the notification service internal API (no auth required for service-to-service)
    const response = await axios.post(
      'http://notification-srv:3000/api/notification/internal',
      notification,
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    logger.log(`Notification created for user ${notification.user_id}: ${notification.title}`);
    return response.data;
  } catch (error) {
    logger.error('Error calling notification service:', error);
    throw error;
  }
}
