// Isolated schema compatibility checks. No provider/production access or real records.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {PGlite}=createRequire(new URL('../tmp/owner-qa-runtime/package.json',import.meta.url))('@electric-sql/pglite');
const read=name=>fs.readFileSync(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8').replace('create extension if not exists pgcrypto;','');
const owner='f1000000-0000-4000-8000-000000000001',admin='f1000000-0000-4000-8000-000000000002',company='f2000000-0000-4000-8000-000000000001';
async function fixture({withoutMedia=false,legacyAdmin=false}={}){
  const db=new PGlite();
  try{
    await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
      create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;`);
    await db.exec(read('202608250900_core_schema_baseline'));
    await db.exec(read('202608311000_core_access_contracts_and_rls'));
    if(withoutMedia)await db.exec('drop table public.work_media;');
    if(legacyAdmin){
      await db.exec(`create or replace function public.is_sales_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.sales_admins where user_id=auth.uid())$$;
        alter table public.sales_admins drop column active;
        alter table public.companies drop column owner_user_id;`);
    }
    await db.exec(`insert into auth.users(id,email) values ('${owner}','titular-ficticio@example.invalid'),('${admin}','administrador-ficticio@example.invalid');
      insert into sales_admins(user_id) values('${admin}');
      insert into companies(id,name,created_by) values('${company}','EMPRESA FICTICIA COMPATIBILIDADE','${owner}');
      insert into company_members(company_id,user_id,email,role) values('${company}','${owner}','titular-ficticio@example.invalid','owner');
      insert into company_app_state(company_id,data) values('${company}','{"fixture":"INFORMACAO FICTICIA PRESERVADA"}');
      insert into app_state(user_id,data) values('${owner}','{"fixture":"ESTADO FICTICIO PRESERVADO"}');`);
    return db;
  }catch(e){await db.close();throw e}
}
const value=async(db,sql,params)=>Object.values((await db.query(sql,params)).rows[0])[0];
test('instala sem a tabela opcional de mídia e protege todos os armazenamentos presentes',async()=>{
  const db=await fixture({withoutMedia:true});
  try{
    const before=(await db.query('select data from company_app_state')).rows;
    await db.exec(read('202609052000_mercadopago_billing'));
    await db.exec(read('202609061030_billing_trial_signup_repair'));
    assert.equal(await value(db,"select to_regclass('public.work_media')"),null);
    assert.equal(await value(db,'select enabled from billing_control'),false);
    for(const table of ['app_state','companies','company_app_state','company_members','company_invitations']){
      assert.equal(await value(db,"select count(*)::int from pg_trigger where tgrelid=to_regclass($1) and tgname='obraativa_billing_write'",['public.'+table]),1);
    }
    await db.exec('select billing_activate()');
    await db.exec(`update billing_accounts set trial_ends_at=now()-interval '1 second' where owner_user_id='${owner}'`);
    for(const table of ['app_state','company_app_state'])await assert.rejects(db.exec(`update ${table} set data='{}'`),/Seus dados estão seguros/);
    assert.deepEqual((await db.query('select data from company_app_state')).rows,before);
  }finally{await db.close()}
});
test('cadastro administrativo legado sem active não quebra consulta, trial ou controle de acesso',async()=>{
  const db=await fixture({legacyAdmin:true});
  try{
    await db.exec(read('202609052000_mercadopago_billing'));
    await db.exec(read('202609061030_billing_trial_signup_repair'));
    assert.equal(await value(db,"select count(*)::int from pg_trigger where tgrelid='public.work_media'::regclass and tgname='obraativa_billing_write'"),1);
    await db.exec('select billing_activate()');
    assert.equal((await value(db,`select billing_account_access('${admin}')`)).mode,'administrator');
    assert.equal((await value(db,`select billing_account_access('${owner}')`)).mode,'trial');
    assert.equal(Number(await value(db,`select extract(epoch from trial_ends_at-trial_started_at)/86400 from billing_accounts where owner_user_id='${owner}'`)),30);
    assert.equal(await value(db,`select billing_company_owner('${company}')`),owner);
    await db.exec(`update billing_accounts set trial_ends_at=now()-interval '1 second' where owner_user_id='${owner}';select set_config('test.uid','${owner}',false);set role authenticated;`);
    const access=await value(db,'select current_company_access()');
    assert.equal(access.allowed,true);assert.equal(access.can_write,false);
    await assert.rejects(db.exec('select billing_admin_report()'),/Acesso exclusivo/);
    await assert.rejects(db.exec(`update app_state set data='{}' where user_id='${owner}'`),/Seus dados estão seguros/);
    assert.equal((await value(db,`select data from app_state where user_id='${owner}'`)).fixture,'ESTADO FICTICIO PRESERVADO');
  }finally{await db.close()}
});
test('cadastro moderno continua negando isenção ao administrador explicitamente inativo',async()=>{
  const db=await fixture();
  try{
    await db.exec(read('202609052000_mercadopago_billing'));
    await db.exec(read('202609061030_billing_trial_signup_repair'));
    await db.exec(`select billing_activate();update sales_admins set active=false where user_id='${admin}';update billing_accounts set trial_ends_at=now()-interval '1 second' where owner_user_id='${admin}';`);
    const access=await value(db,`select billing_account_access('${admin}')`);
    assert.equal(access.mode,'expired');assert.equal(access.can_write,false);
  }finally{await db.close()}
});
