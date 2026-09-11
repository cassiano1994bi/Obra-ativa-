// Remoção autorizada da IA: somente código local e pedidos fictícios, sem rede.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL('../'+name, import.meta.url),'utf8');
globalThis.fetch = async () => { throw Error('REDE REAL PROIBIDA NESTE TESTE FICTÍCIO'); };

test('app atual não carrega a assistente nem suas boas-vindas', () => {
  const html=read('index.html');
  assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*assistant-/);
  assert.doesNotMatch(html, /welcomeAssistantOverlay|showWelcomeAssistant|ANA ·|Eu sou a Ana/);
  for(const module of ['employee-performance-v1.js','work-control-v1.js','work-hub-v1.js','obraativa-billing-v1.js']) assert.ok(html.includes(module));
  for(const action of ['saveRoutineReminder','routineComplete','routinePostpone','routineRemove']) assert.ok(html.includes(action));
});

test('plano e login não anunciam IA e mantêm acesso e preço', () => {
  const source=read('public-assets/obraativa-product-site-v2.js')+read('public-assets/obraativa-reception-v1.js');
  assert.doesNotMatch(source, /Assistente IA|ASSISTENTE INTELIGENTE|funcionária digital|assistant-avatar/);
  assert.ok(source.includes('R$ 69/mês'));
  assert.ok(source.includes('30 dias grátis'));
  assert.ok(source.includes('Criar conta grátis'));
});

test('scripts IA não integram cache e pacote público; convites preservados', () => {
  assert.doesNotMatch(read('service-worker.js'), /['"]\/public-assets\/assistant-[^'"]+\.js['"]/);
  const manifest=JSON.parse(read('scripts/release/public-files.json'));
  assert.equal(manifest.staticFiles.some(path=>/^public-assets\/assistant-.*\.js$/.test(path)),false);
  assert.match(read('netlify/functions/send-company-invite.mjs'), /persistentDailyUsage/);
  assert.match(read('netlify/functions/_assistant/assistant-usage.mjs'), /persistentDailyUsage/);
});

for(const name of ['assistant-obras','assistant-obras-chat','assistant-obras-report','assistant-obras-insights','assistant-obras-performance','assistant-obras-actions']) {
  test(name+' encerra antes de corpo, dados ou provedor', async () => {
    const {default:handler}=await import('../netlify/functions/'+name+'.mjs');
    const request=new Proxy({}, {get(){throw Error('PEDIDO FICTÍCIO NÃO DEVE SER LIDO');}});
    const result=await handler(request);
    assert.equal(result.status,410);
    assert.equal(result.headers.get('cache-control'),'no-store');
    assert.equal((await result.json()).code,'ASSISTANT_DISABLED');
  });
}
