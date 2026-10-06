import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Isolated source harness: no network, production account or browser storage.
const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const controls = fs.readFileSync(new URL('../public-assets/account-session-controls-v1.js', import.meta.url), 'utf8');
const social = fs.readFileSync(new URL('../public-assets/obraativa-social-auth-v1.js', import.meta.url), 'utf8');
const storage = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)), removeItem: k => values.delete(k) }; };
const email = 'teste-auth@example.invalid';
const session = { access_token: 'FICTICIO_ACCESS', refresh_token: 'FICTICIO_REFRESH', user: { id: 'TESTE_USER', email } };
function harness() {
  const messages = [], calls = [], location = { hash: '', search: '', pathname: '/app', href: 'https://teste.invalid/app' };
  const input = { value: '' };
  const button = {};
  const gate = { innerHTML: '', scrollTop: 0, querySelectorAll: () => [], querySelector: q => q === '#obraativaSignupCode' ? input : null };
  const document = { querySelector: q => q === '#cloudGate' ? gate : q === '[data-email-confirmation-resend]' ? button : null };
  const context = vm.createContext({ window: {}, document, location, history: { replaceState: (...args) => calls.push(['history', ...args]) }, sessionStorage: storage(), localStorage: storage(), URLSearchParams, URL, Date, console, setTimeout() {}, clearTimeout() {}, fetch() { throw Error('NETWORK FORBIDDEN IN TESTE'); }, CLOUD_CONFIG: { sessionKey: 'TESTE_SESSION' }, LOCAL_SAAS_TEST_MODE: false });
  context.window = context;
  context.requestAnimationFrame = () => {};
  const a = app.indexOf('window.CloudSync={');
  vm.runInContext(app.slice(a, app.indexOf('\n};', a) + 3), context);
  const r = app.indexOf('Object.assign(window.CloudSync,{', app.indexOf('async signOut'));
  vm.runInContext(app.slice(r, app.indexOf('\n});', r) + 4), context);
  const c = context.CloudSync;
  c.showAuth = (...args) => messages.push(['auth', ...args]);
  c.showLoading = (...args) => messages.push(['loading', ...args]);
  c.showSessionRetry = () => messages.push(['retry']);
  c.saveSession = value => { c.session = value; };
  c.activate = async () => {};
  c.authReturnUrl = () => 'https://teste.invalid/app?invite=TESTE_CONVITE';
  c.request = async (...args) => { calls.push(args); return session; };
  const tail = controls.lastIndexOf("  if (document.readyState");
  vm.runInContext(controls.slice(0, tail) + `window.ObraAtivaAccountControls = { humanizeAuthMessage, clearPendingConfirmation, markConfirmationSent, handleConfirmationFailure, pendingConfirmation: readPendingConfirmation, showEmailConfirmation, lastAuthEmail: () => signupCodeEmail || lastAuthEmail };
  window.TESTE = { setDraft: code => { signupCodeDraft = code; }, state: () => ({ signupConfirmationCooldown, signupCodeDraft }) };\n})();`, context);
  c.showEmailConfirmation = context.ObraAtivaAccountControls.showEmailConfirmation;
  const event = { preventDefault() {}, currentTarget: { elements: { email: { value: email }, password: { value: 'FICTICIO_Senha123' }, token: { value: '001234' } } } };
  return { context, c, event, messages, calls, location, gate, input, button };
}
function installSocial(h) {
  const tail = social.lastIndexOf('  if (document.readyState');
  vm.runInContext(social.slice(0,tail) + 'window.TESTECallback = handleOAuthCallback;\n})();', h.context);
}

test('login aceito e falha da empresa mantém sessão e oferece retry', async () => {
  const h=harness(); h.c.activate=async()=>{throw Error('TESTE conexão da empresa');};
  await h.c.signIn(h.event); assert.equal(h.c.session,session); assert.deepEqual(h.messages.at(-1),['retry']);
});
test('cadastro aceito com sessão não volta ao cadastro após falha da empresa', async () => {
  const h=harness(); h.c.activate=async()=>{throw Error('TESTE conexão da empresa');};
  await h.c.signUp(h.event); assert.deepEqual(h.messages.at(-1),['retry']);
});
test('login pendente abre confirmação sem anunciar envio ou criação', async () => {
  const h=harness(); h.c.request=async()=>{throw Object.assign(Error('Email not confirmed'),{code:'email_not_confirmed'});};
  await h.c.signIn(h.event); assert.match(h.gate.innerHTML,/Confirme seu e-mail/); assert.doesNotMatch(h.gate.innerHTML,/CONTA CRIADA|Enviamos uma mensagem/);
});
test('conta existente ofuscada não dispara conversão nem confirmação', async () => {
  const h=harness(); let tracked=0; h.context.ObraAtivaMetaPixel={track(){tracked++;}};
  h.c.request=async()=>({user:{id:'TESTE_EXISTENTE',identities:[]}}); await h.c.signUp(h.event);
  assert.match(h.messages.at(-1)[2],/já possui uma conta/); assert.equal(tracked,0); assert.equal(h.context.ObraAtivaAccountControls.pendingConfirmation(),null);
});
test('conta pendente repetida não dispara nova conversão', async () => {
  const h=harness(); let tracked=0; h.context.ObraAtivaMetaPixel={track(){tracked++;}};
  h.c.request=async()=>({user:{id:'TESTE_PENDENTE',identities:[{}],created_at:'2000-01-01T00:00:00Z'}});
  await h.c.signUp(h.event); assert.equal(tracked,0); assert.match(h.gate.innerHTML,/Solicitação recebida/);
});
test('cadastro realmente novo registra conversão uma vez e inicia espera', async () => {
  const h=harness(); let tracked=0; h.context.ObraAtivaMetaPixel={track(){tracked++;}};
  h.c.request=async()=>({user:{id:'TESTE_NOVO',identities:[{}],created_at:new Date().toISOString()}});
  await h.c.signUp(h.event); assert.equal(tracked,1); assert.ok(h.context.TESTE.state().signupConfirmationCooldown>Date.now());
});
test('resposta de cadastro vazia não afirma sucesso', async () => {
  const h=harness(); h.c.request=async()=>null; await h.c.signUp(h.event); assert.match(h.messages.at(-1)[2],/resultado do cadastro/);
});
test('OTP de 6 e 8 dígitos preserva zeros e todos os números', async () => {
  for(const token of ['00 1234','00 123456']) { const h=harness(); h.context.ObraAtivaAccountControls.showEmailConfirmation(email); h.event.currentTarget.elements.token.value=token;
    await h.c.confirmSignupCode(h.event); assert.equal(JSON.parse(h.calls[0][1].body).token,token.replace(/\s/g,'')); assert.equal(h.context.ObraAtivaAccountControls.pendingConfirmation(),null);
  }
});
test('OTP com letras ou comprimento incorreto não faz requisição', async () => {
  for(const token of ['abc123','1234567','123456789']) { const h=harness(); h.context.ObraAtivaAccountControls.showEmailConfirmation(email); h.event.currentTarget.elements.token.value=token;
    await h.c.confirmSignupCode(h.event); assert.equal(h.calls.length,0);
  }
});
test('falha de OTP conserva rascunho e resultado vazio não confirma e-mail', async () => {
  const h=harness(); h.context.ObraAtivaAccountControls.showEmailConfirmation(email); h.context.TESTE.setDraft('001234');
  h.c.request=async()=>{throw Error('Token has expired or is invalid');}; await h.c.confirmSignupCode(h.event);
  assert.equal(h.input.value,'001234'); assert.match(h.gate.innerHTML,/código não é válido/);
  h.c.request=async()=>null; await h.c.confirmSignupCode(h.event); assert.match(h.gate.innerHTML,/Não foi possível confirmar o resultado/);
});
test('reenvio mantém retorno e convite, falha de rede não impõe espera', async () => {
  const h=harness(); h.c.request=async(...args)=>{h.calls.push(args);throw Error('Failed to fetch');};
  await assert.rejects(h.c.resendSignupConfirmation(email));
  assert.match(decodeURIComponent(h.calls[0][0]),/redirect_to=https:\/\/teste.invalid\/app\?invite=TESTE_CONVITE/);
  assert.equal(h.context.TESTE.state().signupConfirmationCooldown,0); assert.match(h.gate.innerHTML,/Verifique sua internet/);
});
test('rate limit usa prazo informado e mantém contexto após recarga simulada', async () => {
  const h=harness(); h.context.ObraAtivaAccountControls.showEmailConfirmation(email);
  const error=Object.assign(Error('For security purposes, you can only request this after 90 seconds.'),{status:429,retryAfter:90});
  h.context.ObraAtivaAccountControls.handleConfirmationFailure(error);
  assert.match(h.context.ObraAtivaAccountControls.humanizeAuthMessage(error),/90 segundos/);
  const restored=JSON.parse(h.context.sessionStorage.getItem('obraativa.auth.pending-confirmation.v1'));
  assert.equal(restored.email,email); assert.ok(restored.cooldown>=Date.now()+89000); assert.equal('token' in restored,false);
});
test('link expirado de cadastro não é tratado como recuperação', async () => {
  const h=harness(); h.location.hash='#error=access_denied&error_code=otp_expired&type=signup';
  assert.equal(h.c.passwordRecoveryFromLocation(),null); assert.equal(h.calls.length,0);
  installSocial(h); await h.context.TESTECallback(); assert.equal(h.messages.at(-1)[1],'signin'); assert.match(h.messages.at(-1)[2],/link de acesso expirou/);
});
test('link de recuperação explicitamente marcado abre recuperação', () => {
  const h=harness(); h.location.hash='#error=access_denied&error_code=otp_expired&type=recovery';
  assert.match(h.c.passwordRecoveryFromLocation().message,/link de recuperação expirou/);
});
test('callback com sessão válida e falha na empresa usa retry', async () => {
  const h=harness(); installSocial(h); h.location.hash='#access_token=FICTICIO_ACCESS&refresh_token=FICTICIO_REFRESH&type=signup';
  h.c.request=async()=>session.user; h.c.activate=async()=>{throw Error('TESTE conexão');};
  await h.context.TESTECallback(); assert.deepEqual(h.messages.at(-1),['retry']); assert.equal(h.c.session.user.id,'TESTE_USER');
});
