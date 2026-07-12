// PORT=3000
// MONGO_URI=mongodb://127.0.0.1:27017/realestate_crm?directConnection=true
// SESSION_SECRET=change_this_to_a_long_random_secret
// NODE_ENV=development

// ADMIN_EMAIL=admin@crm.com
// ADMIN_PASSWORD=123456
// ADMIN_NAME=Admin User

// ── Daily Lead Export (Email) ──────────────────────────────────────────────
// EXPORT_EMAIL_USER=youremail@gmail.com        ← যেই Gmail থেকে পাঠাবে
// EXPORT_EMAIL_PASS=etmplzrozjwywwmx            ← Gmail App Password (16 digit, space ছাড়া দিলে safer)
// EXPORT_EMAIL_TO=boss@gmail.com               ← কোথায় পাঠাবে (না দিলে USER-এ যাবে)
// EXPORT_CRON_TIME=0 23 * * *                  ← রাত ১১:০০ (Asia/Dhaka). Default: 0 23 * * *
//
// Optional custom SMTP (যদি Gmail server থেকে block হয়):
// EXPORT_SMTP_HOST=smtp.gmail.com
// EXPORT_SMTP_PORT=587
// EXPORT_SMTP_SECURE=false
// EXPORT_SMTP_REQUIRE_TLS=true
// EXPORT_SMTP_REJECT_UNAUTHORIZED=true