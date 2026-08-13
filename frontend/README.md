# FinCompass Frontend

Production-quality Next.js frontend for the FinCompass financial wellness platform.

## Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- TanStack Query (server state)
- Zustand (client state)
- next-intl (English / Hindi)
- Recharts (responsive charts)
- Framer Motion (subtle animations)
- React Hook Form + Zod

## Getting Started

```bash
# Install dependencies
npm install

# Configure API URL
cp .env.example .env.local

# Start dev server (requires backend at localhost:8000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Backend Integration

The frontend communicates with the existing FastAPI backend at `NEXT_PUBLIC_API_URL`.
No financial data is hardcoded — all values come from REST APIs.

Ensure the backend has your frontend origin in `CORS_ORIGINS`:

```
CORS_ORIGINS=http://localhost:3000
```

## Features

- Landing page with privacy-focused messaging
- Authentication (login, register, forgot/reset password)
- Dashboard with live financial metrics
- Expense tracker with charts
- Cash flow analysis + ML forecast
- Savings goals + capacity estimation
- Budget management with over-budget warnings
- Debt tracking
- Responsible borrowing simulator (not a loan marketplace)
- Explainable credit readiness with correction
- Recommendations, public schemes
- FinAI chatbot (SSE streaming)
- Notifications, consent center, recycle bin, profile
- English / Hindi (next-intl)
- Light / dark / system theme
- Fully responsive (mobile → ultrawide)

## Project Structure

```
src/
├── app/[locale]/          # Localized routes
│   ├── (auth)/            # Login, register, password reset
│   ├── (app)/             # Authenticated app pages
│   └── page.tsx           # Landing page
├── components/            # UI, layout, charts, chat
├── hooks/use-api.ts       # TanStack Query hooks
├── lib/api.ts             # Centralized API client
├── stores/                # Zustand stores
├── messages/              # en.json, hi.json
└── types/                 # TypeScript interfaces
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
