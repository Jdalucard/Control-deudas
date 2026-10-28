// Prueba la migración en un Postgres real (PGlite) imitando lo mínimo de Supabase:
// el esquema `auth`, `auth.uid()` y los roles `anon` / `authenticated`.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";

let db: PGlite;

async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec(uid ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query<Record<string, unknown>>(sql, params)).rows;
}

describe("esquema de deudas", () => {
  let hhA: string;
  let code: string;
  let debtCop: string;
  let debtUsd: string;
  let accountA: string;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create role anon nologin;
      create role authenticated nologin;
      grant usage on schema public, auth to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;
      insert into auth.users (id, email) values
        ('${A}', 'a@test.co'), ('${B}', 'b@test.co'), ('${C}', 'c@test.co');
    `);
    await db.exec(readFileSync(path.join(__dirname, "../migrations/0001_init.sql"), "utf8"));
    // 0002 crea un bucket de Storage; esta base de pruebas no emula ese esquema, así que se omite.
    await db.exec(readFileSync(path.join(__dirname, "../migrations/0003_payment_approval.sql"), "utf8"));
    await db.exec(readFileSync(path.join(__dirname, "../migrations/0004_money.sql"), "utf8"));
  });

  it("A crea un hogar y B no lo ve", async () => {
    hhA = (await as(A, () => rows("select public.create_household('Casa') as id")))[0].id as string;
    expect(hhA).toBeTruthy();
    expect(await as(A, () => rows("select id from public.households"))).toHaveLength(1);
    expect(await as(B, () => rows("select id from public.households"))).toHaveLength(0);
    code = (await rows("select invite_code from public.households"))[0].invite_code as string;
    expect(code).toHaveLength(10);
  });

  it("no se puede crear un segundo hogar ni usar la API sin sesión", async () => {
    await expect(as(A, () => rows("select public.create_household('Otro')"))).rejects.toThrow(/Ya perteneces/);
    await expect(as(null, () => rows("select public.create_household('X')"))).rejects.toThrow();
  });

  it("A crea las deudas; B (sin unirse) no puede leer ni escribir", async () => {
    await as(A, async () => {
      const r1 = await rows(
        "insert into public.debts (household_id, name, currency, initial_amount) values ($1,'Familia','COP',18050000) returning id",
        [hhA],
      );
      const r2 = await rows(
        "insert into public.debts (household_id, name, currency, initial_amount) values ($1,'Otra persona','USD',2000) returning id",
        [hhA],
      );
      debtCop = r1[0].id as string;
      debtUsd = r2[0].id as string;
    });
    expect(await as(B, () => rows("select * from public.debts"))).toHaveLength(0);
    expect(await as(B, () => rows("select * from public.debt_balances"))).toHaveLength(0);
    await expect(
      as(B, () => rows("insert into public.debts (household_id, name, currency, initial_amount) values ($1,'X','COP',1)", [hhA])),
    ).rejects.toThrow(/row-level security/);
  });

  it("abono en pesos a deuda COP descuenta lo mismo", async () => {
    await as(A, () =>
      rows("insert into public.payments (household_id, debt_id, amount_cop) values ($1,$2,1000000)", [hhA, debtCop]),
    );
    const bal = (await as(A, () => rows("select balance, paid_amount from public.debt_balances where debt_id=$1", [debtCop])))[0];
    expect(Number(bal.paid_amount)).toBe(1000000);
    expect(Number(bal.balance)).toBe(17050000);
  });

  it("abono en pesos a deuda USD se convierte con la TRM guardada", async () => {
    await as(A, () =>
      rows("insert into public.payments (household_id, debt_id, amount_cop, trm_used) values ($1,$2,800000,3131.86)", [hhA, debtUsd]),
    );
    const bal = (await as(A, () => rows("select balance, paid_amount from public.debt_balances where debt_id=$1", [debtUsd])))[0];
    expect(Number(bal.paid_amount)).toBeCloseTo(800000 / 3131.86, 5);
    expect(Number(bal.balance)).toBeCloseTo(2000 - 800000 / 3131.86, 5);
    // Otro abono con otra TRM: la TRM de cada abono queda fija.
    await as(A, () =>
      rows("insert into public.payments (household_id, debt_id, amount_cop, trm_used) values ($1,$2,800000,4000)", [hhA, debtUsd]),
    );
    const paid = (await as(A, () => rows("select paid_amount from public.debt_balances where debt_id=$1", [debtUsd])))[0];
    expect(Number(paid.paid_amount)).toBeCloseTo(800000 / 3131.86 + 200, 5);
  });

  it("abono USD sin TRM es rechazado", async () => {
    await expect(
      as(A, () => rows("insert into public.payments (household_id, debt_id, amount_cop) values ($1,$2,100000)", [hhA, debtUsd])),
    ).rejects.toThrow(/TRM es obligatoria/);
  });

  it("B se une con el código y ve todo; el código inválido falla", async () => {
    await expect(as(B, () => rows("select public.join_household('zzzzzzzzzz')"))).rejects.toThrow(/inválido/);
    await as(B, () => rows("select public.join_household($1)", [code.toUpperCase()]));
    expect(await as(B, () => rows("select * from public.debt_balances"))).toHaveLength(2);
    expect(await as(B, () => rows("select * from public.payments"))).toHaveLength(3);
    expect(await as(A, () => rows("select * from public.household_members"))).toHaveLength(2);
  });

  it("B no puede registrar un abono a nombre de A", async () => {
    await expect(
      as(B, () =>
        rows("insert into public.payments (household_id, debt_id, amount_cop, created_by) values ($1,$2,50000,$3)", [hhA, debtCop, A]),
      ),
    ).rejects.toThrow(/row-level security/);
    await as(B, () => rows("insert into public.payments (household_id, debt_id, amount_cop) values ($1,$2,50000)", [hhA, debtCop]));
  });

  it("un tercero no puede colar un abono en la deuda de otro hogar", async () => {
    const hhC = (await as(C, () => rows("select public.create_household('Otro') as id")))[0].id as string;
    await expect(
      as(C, () => rows("insert into public.payments (household_id, debt_id, amount_cop) values ($1,$2,1000)", [hhC, debtCop])),
    ).rejects.toThrow();
    expect(await as(C, () => rows("select * from public.payments"))).toHaveLength(0);
  });

  it("borrar un abono devuelve el saldo", async () => {
    const before = Number((await as(A, () => rows("select balance from public.debt_balances where debt_id=$1", [debtCop])))[0].balance);
    await as(A, () => rows("delete from public.payments where debt_id=$1 and amount_cop=50000", [debtCop]));
    const after = Number((await as(A, () => rows("select balance from public.debt_balances where debt_id=$1", [debtCop])))[0].balance);
    expect(after - before).toBe(50000);
  });

  it("B aprueba un abono de A; A no puede autoaprobarse y una vez aprobado nadie lo edita ni borra", async () => {
    const [pay] = await as(A, () =>
      rows("insert into public.payments (household_id, debt_id, amount_cop) values ($1,$2,30000) returning id", [hhA, debtCop]),
    );
    const payId = pay.id as string;

    await expect(
      as(A, () => rows("update public.payments set approved_by=$1, approved_at=now() where id=$2", [A, payId])),
    ).rejects.toThrow(/payments_approver_not_creator/);

    await as(B, () => rows("update public.payments set approved_by=$1, approved_by_email='b@test.co', approved_at=now() where id=$2", [B, payId]));
    expect((await as(A, () => rows("select approved_by from public.payments where id=$1", [payId])))[0].approved_by).toBe(B);

    const noUpdate = await as(A, () => rows("update public.payments set note='x' where id=$1 returning id", [payId]));
    expect(noUpdate).toHaveLength(0);
    const noDelete = await as(B, () => rows("delete from public.payments where id=$1 returning id", [payId]));
    expect(noDelete).toHaveLength(0);
  });

  it("A crea una cuenta de dinero y un movimiento; B no los ve aunque comparta hogar", async () => {
    const [acc] = await as(A, () =>
      rows("insert into public.money_accounts (user_id, name, currency, initial_amount) values ($1,'Efectivo','COP',100000) returning id", [A]),
    );
    accountA = acc.id as string;
    await as(A, () =>
      rows("insert into public.money_movements (user_id, account_id, kind, amount) values ($1,$2,'ingreso',50000)", [A, accountA]),
    );
    const bal = (await as(A, () => rows("select balance from public.money_account_balances where account_id=$1", [accountA])))[0];
    expect(Number(bal.balance)).toBe(150000);

    expect(await as(B, () => rows("select * from public.money_accounts"))).toHaveLength(0);
    expect(await as(B, () => rows("select * from public.money_account_balances"))).toHaveLength(0);
  });

  it("B no puede insertar un movimiento contra la cuenta de A", async () => {
    await expect(
      as(B, () => rows("insert into public.money_movements (user_id, account_id, kind, amount) values ($1,$2,'gasto',1)", [B, accountA])),
    ).rejects.toThrow();
  });
});
