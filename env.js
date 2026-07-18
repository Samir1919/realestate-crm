// =========================
// Development (.env)
// =========================
// NODE_ENV=development
// PORT=3000
// MONGO_URI=mongodb://127.0.0.1:27017/realestate_crm?directConnection=true
// SESSION_SECRET=change_this_to_a_long_random_secret
// SESSION_COOKIE_SECURE=false
//
// ADMIN_EMAIL=admin@asalagroupbd.com
// ADMIN_PASSWORD=SamSam90@
// ADMIN_NAME=Admin User
//
// EXPORT_EMAIL_USER=icorebd@gmail.com
// EXPORT_EMAIL_PASS=etmp lzro zjwy wwmx
// EXPORT_EMAIL_TO=ryansamir90@gmail.com
//
// Optional in dev
// LEAD_REFERENCE_PREFIX=LD
// EXPORT_CRON_TIME=0 23 * * *
// EXPORT_SMTP_HOST=
// EXPORT_SMTP_PORT=
// EXPORT_SMTP_SECURE=false
// EXPORT_SMTP_REQUIRE_TLS=true
// EXPORT_SMTP_REJECT_UNAUTHORIZED=true
//
// =========================
// Production (.env.production)
// =========================
// NODE_ENV=production
// PORT=3000
//
// External MongoDB VM connection (Docker app -> remote Mongo VM)
// Replace MONGO_VM_IP, username, and password with actual values.
// MONGO_URI=mongodb://crm_user:change_this_password@MONGO_VM_IP:27017/realestate_crm?authSource=admin
//
// Use a long random secret in production (64+ chars recommended)
// SESSION_SECRET=replace_with_a_64_plus_character_random_secret_value
// SESSION_COOKIE_SECURE=true
//
// Initial admin bootstrap user
// ADMIN_EMAIL=admin@yourdomain.com
// ADMIN_PASSWORD=ChangeThisAdminPassword_2026!
// ADMIN_NAME=CRM Admin
//
// Optional
// LEAD_REFERENCE_PREFIX=LD
//
// Daily Lead Export (optional)
// EXPORT_EMAIL_USER=youremail@gmail.com
// EXPORT_EMAIL_PASS=your_gmail_app_password_without_spaces
// EXPORT_EMAIL_TO=recipient@gmail.com
// EXPORT_CRON_TIME=0 23 * * *
//
// Optional custom SMTP
// EXPORT_SMTP_HOST=smtp.gmail.com
// EXPORT_SMTP_PORT=587
// EXPORT_SMTP_SECURE=false
// EXPORT_SMTP_REQUIRE_TLS=true
// EXPORT_SMTP_REJECT_UNAUTHORIZED=true
