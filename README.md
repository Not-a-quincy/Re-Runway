# Re-Runway

A resale streetwear storefront: Express + EJS on the server, MySQL/MariaDB for
data, vanilla JS on the client.

## What's here

- **Catalogue** — `/catalogue`, backed by `GET /api/products` (filters: category,
  size, grade, audience, brand, price range; sorting; pagination).
- **Product detail** — `/products?id=<id-or-slug>`, backed by `GET /api/products/:id`.
- **Cart** — `/cart`, backed by `GET/POST/PATCH/DELETE /api/cart...`. Works for
  guests (tracked via session) and logged-in users; a guest's cart is folded
  into their account automatically the moment they sign up or log in.
- **Auth** — `/login`, `/signup`, backed by `POST /api/auth/{signup,login,logout}`
  and `GET /api/auth/me`. Sessions via `express-session`, passwords hashed with
  bcrypt.
- **Banners** — the hero banner rotation on `/`, unchanged from before.
- **Admin panel** — `/admin`, admin-only. Full write access to products (incl.
  stock, images, sizes), banners, and user roles. Details below.


## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create your `.env`** (copy `.env.example` and fill in real values):
   ```bash
   cp .env.example .env
   
3. **Create the database and load the schema** (creates tables + seeds a
   handful of products/banners so the site isn't empty on first run):
   ```bash
   mysql -u <DB_USER> -p <DB_NAME> < database/schema.sql
   ```

4. **Run it**
   ```bash
   node app.js
   # or, for auto-reload during development:
   npx nodemon app.js
   ```
   Visit `http://localhost:3000`.

## Notes on the data model

- Sizes are per-product (`product_sizes`), each with its own `in_stock` flag —
  that's what lets the PDP disable a specific out-of-stock size (like the
  original hardcoded XL) instead of hiding the whole product.
- A cart is a single row in `carts`, unique per `user_id` OR per guest
  `session_id`; `cart_items` holds the actual line items.
- `original_price` is nullable — products only show a strikethrough
  price/discount badge when it's set.
