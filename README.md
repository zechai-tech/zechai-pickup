# Zécha! — Customer-Facing Pickup Ordering Web App

Mobile-first pickup-ordering frontend for **Zécha!**, a Kerala-based QSR chai/café brand. Designed pixel-perfect to match the Figma/PDF brand guidelines and mobile screens (390×844 base layout).

---

## Quick Start & Local Hosting

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the local development server:**
   ```bash
   npm run dev
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000).

3. **Production build:**
   ```bash
   npm run build
   npm run start
   ```

---

## Design System & Tokens
- **Background Cream:** `#FDFBEA` (with darker background `#EFE5D0` for desktop phone frame)
- **Cards & Surfaces:** `#FFFEF7` with border `#EADFC7`
- **Sand (Chips & Soft Fills):** `#F4E7CC`
- **Orange (Primary CTA & Highlights):** `#CE5535`, Dark `#A8401F`, Soft `#FBEDE3`
- **Espresso (Headings, Text & Dark Cards):** `#2B1A12`, Muted `#75604F`
- **Mustard (Badges & Accents):** `#E8B125`
- **Green (Veg/Open):** `#2F7A3E` | **Red (Non-Veg/Closed):** `#BA1A1A`
- **Typography:** Google Font **Archivo** with variable width axis (`font-stretch: 118%` wide cut for headings via `.font-display`)
- **Icons:** `lucide-react` with 1.8–2.2 stroke
- **QR Code:** `qrcode.react` (SVG)

---

## 8 Customer Screens Flow

1. **`/` Welcome Screen:**
   - Visual food collage with iced coolers, fried chicken, loaded fries cup, and pattern background.
   - Tagline, brand chips ("Ready in ~10 min", "Pay via UPI", "Live order status").
   - Primary CTA "Start your order →" navigates to `/outlet`.
   - "Already ordered? Track my order" checks for existing order or displays toast notification.

2. **`/outlet` Choose Outlet & Pickup Time:**
   - Single-select outlet cards: *Zécha! Thamarassery* (open), *Zécha! Kozhikode Beach* (open), *Zécha! Kunnamangalam* (closed & non-selectable).
   - "When do you want it?" selector: "Pickup now" vs "Schedule" (opens a 15-minute slot bottom sheet).
   - Static promo card ("Coolers at ₹10 off").
   - "View menu →" button enabled only when an open outlet is chosen.

3. **`/menu` Menu & Search:**
   - Header with active outlet selector dropdown to easily switch outlets.
   - Live search input filtering dishes by title, description, and category.
   - Horizontal category chips: Chai & Coffee, Coolers, Chicken, Fries, Subs.
   - Bestseller cards with badges (`BESTSELLER`, `IN CART`).
   - Veg / Non-Veg dot indicators.
   - "ADD" directly adds non-custom items with `- / qty / +` inline stepper, while customizable items open `/item/[id]`.
   - Floating sticky bottom cart bar showing item count, total price, and "View cart →".

4. **`/item/[id]` Item Customization:**
   - Full-bleed hero image with back button and favorite heart button.
   - Cup size radio selectors with dynamic pricing.
   - Segmented sugar level control (No sugar / Less / Regular).
   - Optional add-on checkboxes with delta pricing.
   - Quantity stepper and sticky "Add to cart · ₹X" button updating in real time.

5. **`/cart` Review Cart & Customer Details:**
   - Line items with customization summary, stepper, and trash removal.
   - Pickup details card (selected outlet, ready time, change link).
   - Customer name and 10-digit phone number with inline validation.
   - Optional kitchen instructions input.
   - Real calculated bill: Item total, 5% GST, and grand total.
   - Empty cart state with mascot and "Browse menu" button.
   - "Proceed to pay" disabled until customer details are valid.

6. **`/payment` Mock Razorpay Checkout:**
   - Dark espresso header with amount, order ID, and item count.
   - UPI payment methods (Google Pay, PhonePe, Paytm, BHIM, and custom UPI ID).
   - Collapsible options for Credit/Debit Cards, Netbanking, and Wallets.
   - Dynamic button label ("Pay ₹489 with Google Pay").
   - Simulated gateway processing spinner overlay (2s).
   - "Simulate payment failure" mode with retry and change method options.

7. **`/confirmed` Order Confirmation Ticket:**
   - Pattern background with animated success checkmark.
   - Ticket card with dashed perforated divider and circular cutouts.
   - Order number and estimated ready time.
   - 4-digit pickup code boxes.
   - "Track my order" and "Download receipt" (print view) actions.

8. **`/track` Live Order Status & Ready State:**
   - Vertical timeline: Order placed & paid → Accepted → Preparing → Ready for pickup.
   - Simulated progression timers (Accepted 5s, Preparing 12s, Ready 25s).
   - Demo Speed toggle in header: Normal (1x) vs Fast (4x) for rapid client demos.
   - Ready state: Header switches to vibrant orange, displays "Your order is ready!", triggers confetti animation and toast, shows large pickup code and interactive QR code modal (`qrcode.react`).
   - "I have picked it up" button resets the order and returns to `/`.
   - Reload-safe: uses timestamps in `localStorage` so refreshing never resets the timeline.

---

## Backend Integration Points (`/lib/api.ts`)

All components fetch through `/lib/api.ts`. Replace the internals with your real backend (e.g. Supabase, Firebase, or Fastify) and Razorpay:

1. `getOutlets(): Promise<Outlet[]>`
   - Query active stores table (`outlets` in Supabase/PostgreSQL) with GPS distance and opening hours.
2. `getOutletById(id: string): Promise<Outlet | null>`
   - Fetch single store metadata.
3. `getMenu(outletId?: string): Promise<MenuItem[]>`
   - Query store inventory and pricing.
4. `getMenuItemById(id: string): Promise<MenuItem | null>`
   - Query menu item with available variant sizes and add-ons.
5. `createOrder(payload: CreateOrderPayload): Promise<Order>`
   - Insert new order into orders table and dispatch push notification / POS ticket to kitchen display.
6. `createPayment(payload: ProcessPaymentPayload): Promise<PaymentResult>`
   - Open real Razorpay Standard Checkout SDK (`Razorpay.open()`) with generated `order_id` and webhook callback.
7. `getOrderStatus(orderId: string): Promise<{ orderId: string; status: OrderStatus } | null>`
   - Subscribe to Supabase Realtime / WebSocket channel for live kitchen status changes.
