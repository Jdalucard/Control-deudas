# Control de Deuda y Gastos

App web para llevar **una sola deuda total** (en pesos) cuando una parte está en COP y otra en USD, registrar cada abono y guardar la **TRM de ese día** en cada pago.

- **Deuda total única** arriba: deudas en COP + deudas en USD convertidas a la TRM de hoy.
- **Abonos:** escribes lo que pagaste en pesos; si la deuda es en USD, la app guarda la TRM del día y calcula cuántos dólares descuenta (con vista previa en vivo).
- **TRM automática:** tasa de mercado (open.er-api.com) con respaldo en la TRM oficial (datos.gov.co). Siempre puedes escribirla a mano.
- **Simulador:** "¿y si la TRM fuera X o abono Y?" sin guardar nada.
- **Varias personas** comparten los mismos datos (hogar con código de invitación). Seguridad con RLS de Supabase.
- **Recibos de pago:** al registrar un abono puedes adjuntar una foto o PDF del recibo; se guarda en Supabase Storage y se envía por correo (Gmail SMTP) con el monto abonado y la deuda total restante.
- **Aprobación del pago:** el correo trae un link para que la otra parte, desde su cuenta, confirme que recibió el pago. Una vez aprobado, el abono queda bloqueado (no se puede editar ni borrar) y se avisa por correo a quien lo registró.
- **Gastos e ingresos personales** (`/gastos`): control privado de cuentas, ingresos y gastos; nadie más del hogar lo ve, así compartan la misma deuda.

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + Storage) · Gmail SMTP (correo) · pnpm · Vercel.

## 1. Supabase

1. Crea un proyecto en <https://supabase.com>.
2. **SQL Editor → New query**: pega y ejecuta, en este orden, cada archivo de `supabase/migrations/` (0001, 0002, 0003, 0004) — uno por uno, cada uno en su propia consulta.
3. **Authentication → URL Configuration**
   - Site URL: la URL de tu app (por ahora `http://localhost:3000`; luego la de Vercel).
   - Redirect URLs: agrega `http://localhost:3000/**` y `https://TU-APP.vercel.app/**`.
4. (Opcional) **Authentication → Providers → Email**: si desactivas "Confirm email", no necesitas correo de confirmación. Con la confirmación activa, el SMTP gratuito de Supabase tiene un límite bajo de correos por hora.
5. **Project Settings → API Keys**: copia la *Project URL* y la *publishable key* (o *anon key*). **Nunca** uses la `service_role` en esta app.
6. Cuando todas las personas ya tengan cuenta, desactiva los registros nuevos: **Authentication → Sign In / Providers → "Allow new users to sign up" = off**.

## 2. Gmail (correo del recibo)

1. En la cuenta de Gmail que va a enviar los correos, activa la verificación en 2 pasos: <https://myaccount.google.com/signinoptions/two-step-verification>.
2. Genera una "contraseña de aplicación" en <https://myaccount.google.com/apppasswords> (elige "Otra" y ponle un nombre, ej. "Control de Deuda"). Copia el código de 16 letras.
3. `GMAIL_USER`: esa cuenta de Gmail. `GMAIL_APP_PASSWORD`: el código de 16 letras (no tu contraseña normal de Gmail).
4. `NOTIFY_EMAILS`: los correos que reciben el aviso, separados por coma.

## 3. Correr en local

```bash
pnpm install
cp .env.example .env.local   # y completa las variables (Supabase + Gmail)
pnpm dev                     # http://localhost:3000
```

## 4. Desplegar en Vercel

1. Sube el proyecto a GitHub y en Vercel: **Add New → Project → importa el repo** (framework: Next.js, se detecta solo).
2. En **Environment Variables** agrega todas las de `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (también funciona `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `NEXT_PUBLIC_SITE_URL` = `https://TU-APP.vercel.app`
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_EMAILS`
3. Deploy. Luego vuelve a Supabase y pon esa URL en *Site URL* y *Redirect URLs* (paso 1.3).

## 5. Primer uso

1. **Crear cuenta** con tu correo → **Crear hogar nuevo**.
2. En **Ajustes → Agregar una deuda**, con el saldo de hoy:
   - "Familia / amigos" · Pesos (COP) · `18.050.000`
   - "Otra persona" · Dólares (USD) · `2.000`
3. Las demás personas crean su cuenta y eligen **Unirme con un código** (el código aparece en Ajustes).
4. Cada vez que abones: **Registrar abono** → deuda, fecha, monto en pesos y, si es USD, la TRM de ese día (botón "Traer hoy"). Si adjuntas el recibo, se envía el correo automáticamente con un link para aprobar el pago.

## Cómo se calcula

- Las deudas en USD se llevan **en dólares**. Un abono de `$800.000` con TRM `3.131,86` descuenta `USD 255,44`; el mismo abono con TRM `4.000` descuenta `USD 200`. La TRM de cada abono queda guardada y no cambia después.
- Deuda total = saldo en COP + saldo en USD × TRM de hoy. Por eso el total puede subir o bajar aunque no abones.
- Si abonas más que el saldo, la app avisa y el saldo queda en 0.
- No incluye intereses (tus deudas son sin interés). Si más adelante hay, habría que agregarlo.

## Pruebas

```bash
pnpm test        # cálculos, TRM y el esquema SQL con RLS en un Postgres real (PGlite)
pnpm typecheck
pnpm lint
```

Las pruebas del esquema (`supabase/tests/schema.test.ts`) comprueban, entre otras cosas, que una persona fuera del hogar no ve ni escribe datos, que el abono en USD usa la TRM guardada y que no se pueden mezclar abonos entre hogares.

## Notas

- La tasa de mercado de open.er-api.com se actualiza una vez al día, así que puede diferir de lo que muestra Google en tiempo real. Por eso la TRM es editable en cada abono.
- No hay edición de abonos: si te equivocas, elimínalo y regístralo de nuevo.
- El recibo es opcional; si falla la subida o el envío del correo, el abono queda guardado igual (el mensaje en pantalla avisa qué falló).
- No puedes aprobar un abono que tú mismo registraste; tiene que hacerlo alguien más del hogar.
- Gmail limita el envío a ~500 correos/día por cuenta normal, de sobra para este uso. Si Google bloquea el inicio de sesión por "app poco segura", repite el paso de la contraseña de aplicación (no sirve la contraseña normal de la cuenta).
- Estructura: `supabase/migrations` (SQL), `src/lib` (cálculos, TRM, acceso a datos), `src/app` (pantallas y acciones de servidor), `src/proxy.ts` (refresco de sesión; en Next 16 reemplaza a `middleware.ts`).
