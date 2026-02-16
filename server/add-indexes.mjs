/**
 * Database Performance Indexes Migration
 * Adds composite indexes for all high-traffic query patterns
 */
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function addIndexes() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  const indexes = [
    // Properties - most queried table
    { table: 'properties', name: 'idx_properties_status_city', columns: 'status, city' },
    { table: 'properties', name: 'idx_properties_status_type', columns: 'status, propertyType' },
    { table: 'properties', name: 'idx_properties_status_price', columns: 'status, monthlyRent' },
    { table: 'properties', name: 'idx_properties_status_featured', columns: 'status, isFeatured' },
    { table: 'properties', name: 'idx_properties_status_created', columns: 'status, createdAt' },
    { table: 'properties', name: 'idx_properties_landlord', columns: 'landlordId' },
    { table: 'properties', name: 'idx_properties_status_city_type_price', columns: 'status, city, propertyType, monthlyRent' },
    
    // Bookings
    { table: 'bookings', name: 'idx_bookings_tenant', columns: 'tenantId' },
    { table: 'bookings', name: 'idx_bookings_landlord', columns: 'landlordId' },
    { table: 'bookings', name: 'idx_bookings_property', columns: 'propertyId' },
    { table: 'bookings', name: 'idx_bookings_status', columns: 'status' },
    { table: 'bookings', name: 'idx_bookings_status_created', columns: 'status, createdAt' },
    { table: 'bookings', name: 'idx_bookings_tenant_status', columns: 'tenantId, status' },
    
    // Payments
    { table: 'payments', name: 'idx_payments_booking', columns: 'bookingId' },
    { table: 'payments', name: 'idx_payments_tenant', columns: 'tenantId' },
    { table: 'payments', name: 'idx_payments_landlord', columns: 'landlordId' },
    { table: 'payments', name: 'idx_payments_status', columns: 'status' },
    { table: 'payments', name: 'idx_payments_status_created', columns: 'status, createdAt' },
    
    // Messages & Conversations
    { table: 'messages', name: 'idx_messages_conversation', columns: 'conversationId' },
    { table: 'messages', name: 'idx_messages_conversation_read', columns: 'conversationId, isRead, senderId' },
    { table: 'messages', name: 'idx_messages_conversation_created', columns: 'conversationId, createdAt' },
    { table: 'conversations', name: 'idx_conversations_tenant', columns: 'tenantId' },
    { table: 'conversations', name: 'idx_conversations_landlord', columns: 'landlordId' },
    { table: 'conversations', name: 'idx_conversations_last_msg', columns: 'lastMessageAt' },
    
    // Maintenance Requests
    { table: 'maintenanceRequests', name: 'idx_maintenance_tenant', columns: 'tenantId' },
    { table: 'maintenanceRequests', name: 'idx_maintenance_landlord', columns: 'landlordId' },
    { table: 'maintenanceRequests', name: 'idx_maintenance_property', columns: 'propertyId' },
    { table: 'maintenanceRequests', name: 'idx_maintenance_status', columns: 'status' },
    
    // Emergency Maintenance
    { table: 'emergency_maintenance', name: 'idx_emergency_tenant', columns: 'tenantId' },
    { table: 'emergency_maintenance', name: 'idx_emergency_property', columns: 'propertyId' },
    { table: 'emergency_maintenance', name: 'idx_emergency_status', columns: 'status' },
    { table: 'emergency_maintenance', name: 'idx_emergency_status_urgency', columns: 'status, urgency' },
    
    // Reviews
    { table: 'reviews', name: 'idx_reviews_property', columns: 'propertyId' },
    { table: 'reviews', name: 'idx_reviews_tenant', columns: 'tenantId' },
    { table: 'reviews', name: 'idx_reviews_property_published', columns: 'propertyId, isPublished' },
    
    // Notifications
    { table: 'notifications', name: 'idx_notifications_user', columns: 'userId' },
    { table: 'notifications', name: 'idx_notifications_user_read', columns: 'userId, isRead' },
    { table: 'notifications', name: 'idx_notifications_user_created', columns: 'userId, createdAt' },
    
    // Favorites
    { table: 'favorites', name: 'idx_favorites_user', columns: 'userId' },
    { table: 'favorites', name: 'idx_favorites_user_property', columns: 'userId, propertyId' },
    
    // User Activities (high volume)
    { table: 'userActivities', name: 'idx_activities_user', columns: 'userId' },
    { table: 'userActivities', name: 'idx_activities_action', columns: 'action' },
    { table: 'userActivities', name: 'idx_activities_user_action', columns: 'userId, action' },
    { table: 'userActivities', name: 'idx_activities_created', columns: 'createdAt' },
    
    // Property Manager Assignments
    { table: 'propertyManagerAssignments', name: 'idx_pma_manager', columns: 'managerId' },
    { table: 'propertyManagerAssignments', name: 'idx_pma_property', columns: 'propertyId' },
    
    // Inspection Requests
    { table: 'inspectionRequests', name: 'idx_inspections_user', columns: 'userId' },
    { table: 'inspectionRequests', name: 'idx_inspections_status', columns: 'status' },
    { table: 'inspectionRequests', name: 'idx_inspections_property', columns: 'propertyId' },
    
    // Service Requests
    { table: 'service_requests', name: 'idx_service_req_tenant', columns: 'tenantId' },
    { table: 'service_requests', name: 'idx_service_req_status', columns: 'status' },
    
    // Contact Messages
    { table: 'contact_messages', name: 'idx_contact_status', columns: 'status' },
    { table: 'contact_messages', name: 'idx_contact_created', columns: 'createdAt' },
    
    // AI tables
    { table: 'aiConversations', name: 'idx_ai_conv_user', columns: 'userId' },
    { table: 'aiMessages', name: 'idx_ai_msg_conv', columns: 'conversationId' },
    { table: 'aiMessages', name: 'idx_ai_msg_rating', columns: 'rating' },
    
    // Cities & Districts
    { table: 'cities', name: 'idx_cities_active_featured', columns: 'isActive, isFeatured' },
    { table: 'districts', name: 'idx_districts_city_active', columns: 'city, isActive' },
    { table: 'districts', name: 'idx_districts_cityid_active', columns: 'cityId, isActive' },
    
    // Platform Settings
    { table: 'platformSettings', name: 'idx_settings_key', columns: 'settingKey' },
    
    // Maintenance Updates
    { table: 'maintenance_updates', name: 'idx_maint_updates_id', columns: 'maintenanceId' },
    
    // Push Subscriptions
    { table: 'push_subscriptions', name: 'idx_push_user', columns: 'userId' },
    
    // Users
    { table: 'users', name: 'idx_users_role', columns: 'role' },
    { table: 'users', name: 'idx_users_email', columns: 'email' },
    { table: 'users', name: 'idx_users_created', columns: 'createdAt' },
  ];

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const idx of indexes) {
    try {
      // Check if index already exists
      const [rows] = await conn.query(
        `SELECT COUNT(*) as cnt FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
        [idx.table, idx.name]
      );
      if (rows[0].cnt > 0) {
        skipped++;
        continue;
      }
      await conn.query(`ALTER TABLE \`${idx.table}\` ADD INDEX \`${idx.name}\` (${idx.columns})`);
      created++;
      console.log(`✅ Created: ${idx.name} on ${idx.table}(${idx.columns})`);
    } catch (err) {
      failed++;
      console.warn(`⚠️ Failed: ${idx.name} on ${idx.table} — ${err.message}`);
    }
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} already existed, ${failed} failed`);
  await conn.end();
}

addIndexes().catch(console.error);
