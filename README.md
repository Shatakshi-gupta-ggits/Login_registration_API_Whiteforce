# Login/Registration Backend (Internship Task)

Backend-first Node.js + Express + MongoDB project with minimal frontend and role-based access for:
- `employee`
- `manager`
- `admin`

## Features
- Registration with required fields: `name`, `email`, `password`
- Optional profile fields: `profilePic`, `dob`, `salary`
- Cookie-session based authentication
- Role-protected APIs
- Admin APIs for user management (search, promote, edit, delete)
- Minimal frontend at `/ui` to test all APIs

## Setup
1. Copy `.env.example` to `.env`
2. Fill MongoDB connection string with DB name in URI path (example: `loginreg_db`)
3. (Recommended) Seed/refresh demo users (this also clears non-demo users so Admin dashboard stays clean):
   - `node scripts/reset-demo-data.js`
4. Install and run:
   - Backend: `npm install` then `npm start` (from repo root)
   - Frontend: `cd frontend` then `npm install` then `npm run dev`

Backend listens on: `http://localhost:${PORT}` (check your `.env`; in this project it's `3004`)
Vite frontend usually runs at: `http://localhost:5173` (or `5174` if `5173` is busy)

## Demo Credentials (for Admin Dashboard)
These accounts are seeded by `node scripts/reset-demo-data.js`:
- Admin: `admin@example.com` / `Admin@123`
- Manager: `manager@example.com` / `Manager@123`
- Employee: `employee@example.com` / `Employee@123`

## Run Commands (Full Project)
Run in two terminals:
1. Backend (Express + MongoDB):
   - `cd C:\Users\HP\Downloads\day1Task\node-js-express-login-mongodb-master`
   - `node scripts/reset-demo-data.js`
   - `npm start`
2. Frontend (React + Vite):
   - `cd C:\Users\HP\Downloads\day1Task\node-js-express-login-mongodb-master\frontend`
   - `npm run dev`

## Simple End-to-End Flow (Admin Dashboard)
1. Start backend + frontend using the commands above.
2. Open the frontend: `http://localhost:5173/` (or `5174`).
3. Login with the Admin credentials:
   - `admin@example.com` / `Admin@123`
4. After login, you will be routed to the admin dashboard page:
   - `"/admin-dashboard"`
5. The admin dashboard loads users from:
   - `GET /api/admin/users`
6. You can then manage:
   - promote users to manager (`PATCH /api/admin/users/:id/promote-manager`)
   - edit user details (`PUT /api/admin/users/:id` etc.)
   - delete users (`DELETE /api/admin/users/:id`)

## Core APIs

### Auth
- `POST /api/auth/signup` (multipart/form-data)
  - Required: `name`, `email`, `password`
  - Optional: `role`, `dob`, `salary`, `profilePic`
  - Public signup roles allowed: `employee`, `manager`
- `POST /api/auth/signin` (JSON): `{ "email": "...", "password": "..." }`
- `GET /api/auth/me` (requires login)
- `POST /api/auth/signout`

### Role test
- `GET /api/test/all`
- `GET /api/test/user` (logged-in user)
- `GET /api/test/manager` (manager role)
- `GET /api/test/admin` (admin role)

### Admin management
- `GET /api/admin/users?search=&page=1&limit=10`
- `PATCH /api/admin/users/:id/promote-manager`
- `PATCH /api/admin/users/:id` (can update `name`, `dob`, `salary`, `profilePic`)
  - Email/password updates are blocked by design
- `DELETE /api/admin/users/:id`
  - Admin cannot delete own account
  - Admin accounts cannot be deleted from this endpoint

## How to access `/admin`
Admin UI is accessed via the frontend route `"/admin-dashboard"` after logging in as an admin.

If you are using the Express-served static pages instead, the admin panel can also be opened at:
`http://localhost:${PORT}/admin`

In both cases, login using the seeded demo admin credentials (see “Demo Credentials” above).
