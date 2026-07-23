# API Documentation (Overview)

## Auth
- POST /login — Request body: { email, password }
- GET /logout

## Admin
- GET /admin/roles
- POST /admin/roles/create — Body: { name }
- POST /admin/roles/:id/update — Body: { name }
- POST /admin/roles/:id/delete
- POST /admin/roles/:id/permissions — Body: { permissions: string[] }
- POST /admin/permissions/create — Body: { key, description }
- POST /admin/permissions/:id/update — Body: { key, description }
- POST /admin/permissions/:id/delete

## Health
- GET /healthz

Notes:
- Most admin routes require capability `roles.manage`.
- CSRF protection enabled; include CSRF token in form submissions.
