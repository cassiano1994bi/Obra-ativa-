import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(new URL('../tmp/owner-qa-runtime/package.json', import.meta.url))('@electric-sql/pglite');
const owner = '91000000-0000-4000-8000-000000000001', member = '91000000-0000-4000-8000-000000000002';
const admin = '91000000-0000-4000-8000-000000000003', company = '92000000-0000-4000-8000-000000000001';
const newUser = '91000000-0000-4000-8000-000000000004';
const read = name => fs.readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8').replace('create extension if not exists pgcrypto;', '');

test('assinaturas: PostgreSQL isolado, dados FICTÍCIOS, nenhuma chamada externa', async t => {
  const db = new PGlite();
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const value = async (sql, params) => Object.values((await q(sql, params))[0])[0];
  const as = async (id, role = 'authenticated') => db.exec(`reset role; select set_config('test.uid','${id || ''}',false); set role ${role};`);
  let a;
  const access = () => value(`select billing_account_access('${owner}')`);
  const time = delta => new Date(Date.now() + delta).toISOString();
  const day = 86400000;
  async function payment(id, status, debit, modified, approved = null, invoice = id) {
    return value('select billing_apply_provider($1,$2,$3,$4,null,$5::jsonb)', [a.id,'TEST_SUBSCRIPTION','authorized',time(0), JSON.stringify({ id, invoice_id:invoice,status,amount:69,currency:'BRL',debit_at:debit,modified_at:modified,approved_at:approved })]);
  }
  try {
    await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
      create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;`);
    await db.exec(read('202608250900_core_schema_baseline'));
    await db.exec(read('202608311000_core_access_contracts_and_rls'));
    await db.exec(`insert into auth.users(id,email,created_at) values
      ('${owner}','dono-ficticio@example.invalid',now()-interval '1 year'),
      ('${member}','membro-ficticio@example.invalid',now()-interval '1 year'),
      ('${admin}','admin-ficticio@example.invalid',now()-interval '1 year');
      insert into sales_admins(user_id) values('${admin}');
      insert into companies(id,name,owner_user_id) values('${company}','EMPRESA FICTÍCIA ASSINATURA','${owner}');
      insert into company_members(company_id,user_id,email,role) values
      ('${company}','${owner}','dono-ficticio@example.invalid','owner'),('${company}','${member}','membro-ficticio@example.invalid','viewer');
      insert into company_app_state(company_id,data) values('${company}','{"fixture":"DADOS FICTÍCIOS PRESERVADOS"}');
      insert into subscriptions(company_id,trial_ends_at) values('${company}',now()-interval '1 year');
      insert into app_state(user_id,data) values('${owner}','{"fixture":"CONTA ANTIGA FICTÍCIA"}');`);
    const before = await q('select data from company_app_state');
    await db.exec(read('202609052000_mercadopago_billing'));
    await db.exec(read('202609061030_billing_trial_signup_repair'));
    await t.test('instalação não ativa nem modifica dados; mantém acesso legado', async () => {
      assert.equal((await access()).enabled, false);
      await as(owner);
      assert.equal((await value('select current_company_access()')).allowed, false);
      await db.exec('reset role');
      assert.deepEqual(await q('select data from company_app_state'), before);
    });
    await t.test('ativação concede 30 dias a contas antigas, sem renovar ao repetir', async () => {
      await value('select billing_activate()');
      const start = await q('select trial_started_at,trial_ends_at from billing_accounts order by owner_user_id');
      assert.equal(start.length, 3);
      assert.equal((+new Date(start[0].trial_ends_at)-new Date(start[0].trial_started_at))/day,30);
      assert.equal((await access()).mode,'trial');
      await value('select billing_activate()');
      assert.deepEqual(await q('select trial_started_at,trial_ends_at from billing_accounts order by owner_user_id'),start);
      assert.deepEqual(await q('select data from company_app_state'),before);
    });
    await t.test('novo cadastro recebe acesso completo automaticamente; convidado não ganha cobrança da empresa', async () => {
      await db.exec(`insert into auth.users(id,email) values('${newUser}','novo-ficticio@example.invalid');`);
      assert.equal(await value(`select extract(epoch from trial_ends_at-trial_started_at)/86400 from billing_accounts where owner_user_id='${newUser}'`), '30.0000000000000000');
      await db.exec(`delete from billing_accounts where owner_user_id='${newUser}'`);
      await as(newUser);
      const repaired=await value('select billing_access()');
      assert.equal(repaired.mode,'trial');assert.equal(repaired.can_write,true);
      await db.exec('reset role');
      assert.equal(await value(`select extract(epoch from trial_ends_at-trial_started_at)/86400 from billing_accounts where owner_user_id='${newUser}'`), '30.0000000000000000');
      await as(member);
      const result = await value(`select billing_access('${company}')`);
      assert.equal(result.can_manage, false); assert.equal(result.owner_user_id,owner); assert.equal(result.can_write,true);
      await db.exec('reset role');
    });
    await t.test('RLS e funções privadas não permitem forjar pagamento ou ler outra conta', async () => {
      await as(null,'anon'); await assert.rejects(q('select billing_access()'),/permission denied/);
      await as(newUser); await assert.rejects(q(`select billing_access('${company}')`),/Acesso negado/);
      await assert.rejects(q(`select billing_account_access('${owner}')`),/permission denied/);
      await assert.rejects(q('select * from billing_payments'),/permission denied/);
      await assert.rejects(q('select billing_activate()'),/permission denied/);
      await assert.rejects(q('select billing_admin_report()'),/Acesso exclusivo/);
      await as(admin); assert.equal((await value('select billing_admin_report()')).rows.length,4);
      await db.exec('reset role');
    });
    await t.test('cadastro de empresa mantém todos os módulos; tabela antiga não reintroduz plano limitado', async () => {
      await as(newUser);
      const id=await value("select create_company_with_owner('EMPRESA NOVA FICTÍCIA DE TESTE')");
      const own=await value(`select billing_access('${id}')`);
      assert.equal(own.can_write,true);assert.equal(own.mode,'trial');
      await db.exec('reset role');
      const subscription=(await q('select plan,trial_ends_at from subscriptions where company_id=$1',[id]))[0];
      assert.equal(subscription.plan,'custom');
      assert.equal(+new Date(subscription.trial_ends_at),+new Date(own.trial_ends_at));
      await assert.rejects(q("update subscriptions set status='active' where company_id=$1",[id]),/assinatura agora é automática/);
    });
    await t.test('vencimento bloqueia INSERT UPDATE DELETE no servidor, mas login e consultas permanecem', async () => {
      await db.exec(`update billing_accounts set trial_ends_at=now()-interval '1 second' where owner_user_id='${owner}';`);
      assert.equal((await access()).can_write,false);
      await assert.rejects(q(`update company_app_state set data='{}' where company_id='${company}'`),/Seus dados estão seguros/);
      await assert.rejects(q(`delete from company_app_state where company_id='${company}'`),/Seus dados estão seguros/);
      await assert.rejects(q(`insert into companies(name,owner_user_id,created_by) values('TESTE SEM RENOVAR TRIAL','${owner}','${owner}')`),/Seus dados estão seguros/);
      await as(owner);
      assert.equal((await value('select current_company_access()')).allowed,true);
      assert.equal((await value('select current_company_access()')).can_write,false);
      assert.equal((await q(`select data from app_state where user_id='${owner}'`)).length,1);
      await assert.rejects(q(`update app_state set data='{}' where user_id='${owner}'`),/Seus dados estão seguros/);
      await db.exec('reset role'); assert.deepEqual(await q('select data from company_app_state where company_id=$1',[company]),before);
    });
    await t.test('reserva persistente não duplica recorrência; authorized sozinho não libera acesso', async () => {
      a = await value(`select billing_claim_checkout('${owner}')`);
      const again = await value(`select billing_claim_checkout('${owner}')`);
      assert.equal(a.created,true); assert.equal(again.created,false); assert.equal(a.id,again.id);
      await value('select billing_apply_provider($1,$2,$3,$4)',[a.id,'TEST_SUBSCRIPTION','authorized',time(-10000)]);
      assert.equal((await access()).can_write,false);
      assert.equal(await value('select billing_claim_sync($1)',[a.id]),true);
      assert.equal(await value('select billing_claim_sync($1)',[a.id]),false);
    });
    await t.test('falha: 3 dias; repetir notificação não reinicia tolerância', async () => {
      await payment('TEST_FAIL','rejected',time(-day),time(-1000));
      assert.equal((await access()).mode,'grace');
      const grace=(await access()).grace_ends_at;
      await payment('TEST_FAIL','rejected',time(-day),time(-1000));
      assert.equal((await access()).grace_ends_at,grace);
      await db.exec("update billing_payments set debit_at=now()-interval '4 days' where provider_payment_id='TEST_FAIL'");
      assert.equal((await access()).mode,'payment_due');
    });
    await t.test('confirmação aprovada reativa automaticamente; retry da mesma fatura e replay não prolongam período', async () => {
      const debit=time(-day), modified=time(0), approved=time(-5000);
      await payment('TEST_PAID','approved',debit,modified,approved,'TEST_FAIL');
      assert.equal((await access()).mode,'active');
      const until=(await access()).paid_until;
      await payment('TEST_PAID','approved',debit,modified,approved,'TEST_FAIL');
      assert.equal((await access()).paid_until,until);
      await payment('TEST_PAID','rejected',time(-day),time(-50000));
      assert.equal((await access()).mode,'active');
      await db.exec(`update company_app_state set data=data||'{"teste":"SALVOU"}' where company_id='${company}';`);
    });
    await t.test('cancelar mantém período pago e dados; no vencimento fica só consulta', async () => {
      await value('select billing_apply_provider($1,$2,$3,$4)',[a.id,'TEST_SUBSCRIPTION','cancelled',time(1000)]);
      assert.equal((await access()).mode,'active');
      await db.exec("update billing_payments set period_ends_at=now()-interval '1 second' where status='approved'");
      assert.equal((await access()).mode,'cancelled');
      assert.equal((await q('select data from company_app_state where company_id=$1',[company]))[0].data.fixture,'DADOS FICTÍCIOS PRESERVADOS');
    });
    await t.test('estorno retira autorização paga; webhook antigo não desfaz cancelamento', async () => {
      await payment('TEST_PAID','refunded',time(-day),time(2000));
      assert.equal((await access()).can_write,false);
      assert.equal(await value('select status from billing_attempts where id=$1',[a.id]),'cancelled');
      assert.equal(await value("select count(*)::int from billing_payments where status='approved'"),0);
    });
  } finally { await db.close(); }
});
