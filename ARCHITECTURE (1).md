# System Architecture – handelsfastigheter-order-flow

## Overview
Systemet är en frontend-driven internplattform byggd med:

- React 18 + TypeScript + Vite
- Supabase (Auth + DB + RPC + Realtime + Edge Functions)
- Tailwind + shadcn/ui

Arkitekturen är en **thin-backend / fat-client hybrid**, där mycket logik ligger i frontend.

---

## Core Layers

### 1. Authentication Layer
- Supabase Auth
- Hook: `useAuth.tsx`

Ansvar:
- Session
- User
- Profile
- Roles (direct + via groups)

Risk:
- Flera datakällor för roller → risk för inkonsistens

---

### 2. Authorization Layer

Består av:

- `useModules.tsx`
- `useModulePermission.tsx`
- `useAdminAccess.tsx`
- `ProtectedRoute.tsx`

Flöde:

User → Roles → Groups → Module Permissions → Route access

Risk:
- Ingen central “source of truth”
- Client-side enforcement

---

### 3. Navigation Layer

- `useNavSettings.tsx`
- Dynamisk route enable/disable

Risk:
- Route kan vara disabled i UI men fortfarande nåbar

---

### 4. Order System (Core Domain)

Centrala tabeller:
- `orders`
- `order_items`
- `order_systems`

Flöde:

1. Skapa order
2. Skapa items
3. Skicka notifiering
4. Skicka email
5. Approval
6. Delivery

Risk:
- Multi-step write utan transaction

---

### 5. Approval Engine

Central funktion:
`resolveApprovalRouting(...)`

Bestämmer:
- autoApprove
- CEO approval
- Manager approval
- approver_id

Risk:
- Ligger i frontend → kan manipuleras

---

### 6. Admin System

- `Admin.tsx`
- Lazy-loaded moduler

Access:
- `useAdminAccess`
- module permissions

Risk:
- UI gating ≠ verklig säkerhet

---

### 7. Realtime Layer

- Supabase channels
- Debounced reload

Risk:
- Race conditions
- stale UI

---

## Data Flow

User → UI → Supabase (direct)

Ingen middleware layer.

---

## Critical Observations

### 1. Backend saknar tydlig enforcement layer
→ frontend ansvarar för:
- auth decisions
- approval logic
- access control

### 2. Multi-step operations saknar transaction
→ order + items + email

### 3. Permissions är distribuerade
→ svårt att garantera korrekt beteende

---

## Recommendation (arkitektur)

Prioritet:

1. Backend enforcement (RLS / RPC validation)
2. Central permission resolver
3. Transaction-liknande hantering (RPC)
4. Flytta approval logic server-side

---

## Summary

Systemet är välbyggt men:

- Business logic ligger i frontend
- Authorization är distribuerad
- Order flow saknar transaktionssäkerhet

Detta är största riskerna.
