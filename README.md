# Capital

App web para llevar las finanzas de un hogar y, aparte, un negocio de dropshipping (Dropi, contra entrega) — dos módulos separados, cada uno con su propia privacidad.

## Finanzas y deudas

- **Deuda total única** arriba: deudas en COP + deudas en USD convertidas a la TRM de hoy.
- **Abonos:** escribes lo que pagaste en pesos; si la deuda es en USD, la app guarda la TRM del día y calcula cuántos dólares descuenta (con vista previa en vivo).
- **TRM automática:** tasa de mercado (open.er-api.com) con respaldo en la TRM oficial (datos.gov.co). Siempre puedes escribirla a mano.
- **Simulador:** "¿y si la TRM fuera X o abono Y?" sin guardar nada.
- **Varios usuarios** comparten los mismos datos (un grupo con código de invitación). Seguridad con RLS de Supabase.
- **Recibos de pago:** al registrar un abono puedes adjuntar una foto o PDF del recibo; se guarda en Supabase Storage y se envía por correo (Gmail SMTP) con el monto abonado y la deuda total restante.
- **Aprobación del pago:** el correo trae un link para que la otra parte, desde su cuenta, confirme que recibió el pago. Una vez aprobado, el abono queda bloqueado (no se puede editar ni borrar) y se avisa por correo a quien lo registró.
- **Gastos e ingresos** (`/money`, `/income`): control privado de cuentas, ingresos y gastos — nadie más del grupo lo ve, así compartan la misma deuda. Cada movimiento se marca como **Personal** o **Negocio**, con resumen por tipo.

## Dropshipping · Dropi

Módulo separado y privado por usuario (ni siquiera el resto de tu grupo lo ve), para validar y operar productos en modalidad contra entrega:

- **Productos** (`/dropship/products`): da de alta un producto candidato, califícalo (checklist no-negociable + matriz de 25 puntos) y mira el veredicto en vivo, antes de invertir un peso en pauta.
  - **Lista**: tus productos ya creados, con su margen, puntaje y semáforo.
  - **Radar**: compara tus productos ya creados entre sí (ventas 7/30 días, CAC, semáforo) para decidir a cuál escalarle la pauta.
  - **Descubrir**: busca en tu catálogo real de Dropi (stock, precio sugerido, bodegas), consulta "¿dónde más se vende?" (búsqueda inversa de imagen vía SerpApi/Google Lens) y crea el producto candidato con un clic. También muestra **anuncios en tendencia** de Meta Ad Library y TikTok Top Ads, pre-scrapeados una vez al día (no en vivo) y embebidos aquí mismo.
- **Efectividad** (`/dropship/effectiveness`): tablero cruzado de todos tus productos con su semáforo (🔴 cortar / 🟡 mantener / 🟢 escalar), calculado con CAC, margen y entrega real.
- **Simulador**: sliders de precio/entrega/CAC para ver el punto de equilibrio sin tocar datos reales.
- **Mensajes WhatsApp**: plantillas (confirmación, despacho, día de entrega) listas para enviar por `wa.me`.
- **Devoluciones**: auditoría de motivos de devolución por tanda de pedidos, para detectar qué producto se devuelve más y por qué.
- **Caja**: proyección de 30 días de gasto de pauta vs. liquidaciones esperadas de Dropi.
- **Calendario**: fechas comerciales clave (cierre de pauta de diciembre, Día de la Madre, primas, etc.).
- **Ajustes** (`/dropship/settings`): tus API keys de Dropi y SerpApi, y los días de liquidación de Dropi.

### Integraciones reales

- **Dropi**: catálogo y stock reales vía su API de Integraciones (`src/lib/dropi.ts`), con tu propio `dropi-integration-key` (requiere que Dropi habilite tu dominio — ver sección 6).
- **SerpApi (Google Lens)**: búsqueda inversa de imagen para ver en cuántas tiendas más se vende un producto (`src/lib/serpapi.ts`).
- **Anuncios en tendencia**: un scraper aparte (Playwright, `scripts/scrape-trending-ads.mjs`) corre una vez al día vía GitHub Actions y guarda anuncios reales de Meta Ad Library y TikTok Top Ads en Supabase — nunca se scrapea en vivo dentro de la app.

Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + Storage) · Gmail SMTP · Dropi + SerpApi (dropshipping) · Playwright + GitHub Actions (scraper de anuncios) · pnpm · Netlify.

## 1. Supabase

1. Crea un proyecto en <https://supabase.com>, bajo tu **cuenta personal** (no una de trabajo/organización compartida).
2. **SQL Editor → New query**: pega y ejecuta, en este orden, cada archivo de `supabase/migrations/` (0001 a 0013 — son 13 en total) — uno por uno, cada uno en su propia consulta.
3. **Authentication → URL Configuration**
   - Site URL: la URL de tu app (por ahora `http://localhost:3000`; luego la de Netlify).
   - Redirect URLs: agrega `http://localhost:3000/**` y `https://TU-APP.netlify.app/**`.
4. (Opcional) **Authentication → Providers → Email**: si desactivas "Confirm email", no necesitas correo de confirmación. Con la confirmación activa, el SMTP gratuito de Supabase tiene un límite bajo de correos por hora.
5. **Project Settings → API Keys**: copia la *Project URL* y la *Publishable key* (en proyectos nuevos reemplaza a la antigua *anon key*). **Nunca** uses la *Secret key* (service_role) en esta app — esa solo la usa el scraper de anuncios, desde GitHub Actions (ver sección 6).
6. Cuando todas las personas de tu grupo ya tengan cuenta, desactiva los registros nuevos: **Authentication → Sign In / Providers → "Allow new users to sign up" = off**.

## 2. Gmail (correo del recibo)

1. En la cuenta de Gmail que va a enviar los correos, activa la verificación en 2 pasos: <https://myaccount.google.com/signinoptions/two-step-verification>.
2. Genera una "contraseña de aplicación" en <https://myaccount.google.com/apppasswords> (elige "Otra" y ponle un nombre, ej. "Capital"). Copia el código de 16 letras.
3. `GMAIL_USER`: esa cuenta de Gmail. `GMAIL_APP_PASSWORD`: el código de 16 letras, sin espacios (no tu contraseña normal de Gmail).
4. `NOTIFY_EMAILS`: los correos que reciben el aviso, separados por coma.

## 3. Correr en local

```bash
pnpm install
cp .env.example .env.local   # y completa las variables (Supabase + Gmail)
pnpm dev                     # http://localhost:3000
```

## 4. Desplegar en Netlify

1. Sube el proyecto a GitHub y en Netlify: **Add new site → Import an existing project** (framework Next.js, se detecta solo).
2. En **Site configuration → Environment variables** agrega todas las de `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (también funciona `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `NEXT_PUBLIC_SITE_URL` = `https://TU-APP.netlify.app`
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_EMAILS`
3. Deploy. Luego vuelve a Supabase y pon esa URL en *Site URL* y *Redirect URLs* (paso 1.3).

## 5. Dropshipping: API keys y scraper de anuncios

1. En `/dropship/settings`, pega tu API key de Dropi (genera un token tipo **WooComerce**, no "Lucidbot", desde Dropi → Mis Integraciones — y pide que te habiliten el dominio, ver nota abajo) y tu key de SerpApi (gratis en serpapi.com, 250 búsquedas/mes).
2. **Dropi solo deja consumir su API si tu dominio/IP ya está habilitado por su equipo de TI** — no es autoservicio. Si recibes `401 Access denied`, escríbeles por correo (no por chat) pidiendo el acceso, indicando el dominio, los endpoints que necesitas y el ID de tu cuenta Dropi.
3. El scraper de anuncios en tendencia (`scripts/scrape-trending-ads.mjs`) corre aparte, vía GitHub Actions (`.github/workflows/scrape-trending-ads.yml`), una vez al día. Para activarlo, agrega estos **secrets del repositorio** en GitHub (Settings → Secrets and variables → Actions):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (la *Secret key*, no la publishable — esta sí puede escribir saltándose RLS; por eso solo vive aquí, nunca en Netlify/.env.local)

   Puedes dispararlo a mano desde la pestaña **Actions → Scrape trending ads → Run workflow** para probarlo.

## 6. Primer uso

1. **Crear cuenta** con tu correo → **Crear grupo nuevo**.
2. En **Ajustes → Agregar una deuda**, con el saldo de hoy:
   - "Familia / amigos" · Pesos (COP) · `18.050.000`
   - "Otra persona" · Dólares (USD) · `2.000`
3. Las demás personas crean su cuenta y eligen **Unirme con un código** (el código aparece en Ajustes).
4. Cada vez que abones: **Registrar abono** → deuda, fecha, monto en pesos y, si es USD, la TRM de ese día (botón "Traer hoy"). Si adjuntas el recibo, se envía el correo automáticamente con un link para aprobar el pago.
5. Para dropshipping: entra a **Productos → Descubrir**, busca un producto en tu catálogo de Dropi y agrégalo como candidato, o créalo a mano en la pestaña **Lista**.

## Cómo se calcula

- Las deudas en USD se llevan **en dólares**. Un abono de `$800.000` con TRM `3.131,86` descuenta `USD 255,44`; el mismo abono con TRM `4.000` descuenta `USD 200`. La TRM de cada abono queda guardada y no cambia después.
- Deuda total = saldo en COP + saldo en USD × TRM de hoy. Por eso el total puede subir o bajar aunque no abones.
- Si abonas más que el saldo, la app avisa y el saldo queda en 0.
- No incluye intereses (tus deudas son sin interés). Si más adelante hay, habría que agregarlo.
- Dropshipping: margen = precio de venta − costo proveedor − flete. El semáforo compara tu CAC (gasto de pauta ÷ pedidos creados) contra el CAC máximo que tu margen y tu entrega real pueden sostener.

## Pruebas

```bash
pnpm test        # cálculos, TRM, dropshipping, Dropi/SerpApi, y el esquema SQL con RLS en un Postgres real (PGlite)
pnpm typecheck
pnpm lint
```

Las pruebas del esquema (`supabase/tests/schema.test.ts`) comprueban, entre otras cosas, que una persona fuera de tu grupo no ve ni escribe tus datos, que el abono en USD usa la TRM guardada, que los datos de dropshipping son privados por usuario (no por grupo), y que el catálogo de anuncios en tendencia es de solo lectura para cualquier usuario autenticado (solo el scraper, con la service_role key, puede escribir ahí).

## Notas

- La tasa de mercado de open.er-api.com se actualiza una vez al día, así que puede diferir de lo que muestra Google en tiempo real. Por eso la TRM es editable en cada abono.
- No hay edición de abonos: si te equivocas, elimínalo y regístralo de nuevo.
- El recibo es opcional; si falla la subida o el envío del correo, el abono queda guardado igual (el mensaje en pantalla avisa qué falló).
- No puedes aprobar un abono que tú mismo registraste; tiene que hacerlo alguien más de tu grupo.
- Gmail limita el envío a ~500 correos/día por cuenta normal, de sobra para este uso. Si Google bloquea el inicio de sesión por "app poco segura", repite el paso de la contraseña de aplicación (no sirve la contraseña normal de la cuenta).
- Los endpoints de Dropi y el formato de los anuncios de Meta/TikTok no están documentados públicamente (los de Dropi sí, por PDF propio; los de Meta/TikTok se identificaron investigando sus páginas) y pueden cambiar sin aviso — si el scraper empieza a traer 0 resultados, revisa el log del workflow en GitHub Actions antes que nada.
- Estructura: `supabase/migrations` (SQL), `src/lib` (cálculos, TRM, Dropi, SerpApi, acceso a datos), `src/app` (pantallas y acciones de servidor), `scripts/` (scraper de anuncios, corre fuera de la app), `src/proxy.ts` (refresco de sesión; en Next 16 reemplaza a `middleware.ts`).
