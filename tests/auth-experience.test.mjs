import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'public-assets', 'account-session-controls-v1.js'), 'utf8');
const style = fs.readFileSync(path.join(root, 'public-assets', 'account-session-controls-v1.css'), 'utf8');
const receptionSource = fs.readFileSync(path.join(root, 'public-assets', 'obraativa-reception-v1.js'), 'utf8');
const receptionStyle = fs.readFileSync(path.join(root, 'public-assets', 'obraativa-reception-v1.css'), 'utf8');
const receptionConfig = fs.readFileSync(path.join(root, 'public-assets', 'obraativa-reception-config-v1.js'), 'utf8');
const socialAuthSource = fs.readFileSync(path.join(root, 'public-assets', 'obraativa-social-auth-v1.js'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

test('cadastro e recuperação ganham clareza sem alterar autenticação', () => {
  assert.match(source, /humanizeAuthMessage/);
  assert.match(source, /E-mail ou senha não conferem/);
  assert.match(source, /Criar minha conta grátis/);
  assert.match(source, /Enviar instruções por e-mail/);
  assert.match(source, /Mostrar senha/);
  assert.match(source, /Ocultar senha/);
  assert.match(source, /obraativa-password-strength/);
  assert.match(source, /ETAPA 1 DE 2/);
  assert.match(source, /ETAPA 2 DE 2/);
  assert.match(source, /obraativa-auth-optional/);
  assert.doesNotMatch(source, /CloudSync\.request\(/);
  assert.doesNotMatch(source, /fetch\(/);
});

test('recepção comercial envolve os formulários sem substituir a autenticação', () => {
  for (const token of ['Mais controle', 'Menos perdas', 'Bem-vindo de volta', 'Seus dados estão protegidos', 'App Store · Em breve']) {
    assert.match(receptionSource, new RegExp(token));
  }
  assert.match(receptionSource, /card\.replaceWith\(shell\)/);
  assert.doesNotMatch(receptionSource, /ASSISTENTE INTELIGENTE|assistant-avatar-v1\.png|obraativa-reception-ai/);
  assert.match(receptionSource, /access\.appendChild\(card\)/);
  assert.doesNotMatch(receptionSource, /CloudSync\.request|signIn\s*=|signUp\s*=|fetch\(|localStorage/);
});

test('escolhas de acesso ficam explícitas sem recriar eventos de autenticação', () => {
  assert.match(receptionSource, /Entrar ou criar conta/);
  assert.match(receptionSource, /Criar conta grátis/);
  assert.match(receptionSource, /30 dias grátis/);
  assert.match(receptionSource, /Já tem conta/);
  assert.match(receptionSource, /form\?\.insertAdjacentElement\('afterend', choices\)/);
  assert.match(receptionSource, /switchButton\.dataset\.accessMode = nextMode/);
  assert.match(receptionSource, /choices\.append\(switchButton\)/);
  assert.doesNotMatch(receptionSource, /switchButton\.(?:onclick|onsubmit)\s*=/);
  assert.match(receptionStyle, /\.obraativa-access-choices/);
  assert.match(receptionStyle, /min-height:44px!important/);
});

test('prova social fica configurável e não publica números não verificados', () => {
  assert.match(receptionConfig, /verified:\s*false/);
  assert.match(receptionSource, /!proof\.verified && !isLocalPreview\(\)/);
  for (const token of ['+2.500', '+1.200', '98%']) assert.match(receptionConfig, new RegExp(token.replace('+', '\\+')));
});

test('Google e Microsoft usam OAuth do Supabase sem credenciais sensíveis no navegador', () => {
  assert.match(socialAuthSource, /\/auth\/v1\/authorize/);
  assert.match(socialAuthSource, /supabase:\s*'google'/);
  assert.match(socialAuthSource, /supabase:\s*'azure'/);
  assert.match(socialAuthSource, /redirect_to/);
  assert.match(socialAuthSource, /canonicalAppEntryUrl/);
  assert.match(socialAuthSource, /\/auth\/v1\/settings/);
  assert.match(socialAuthSource, /settings\?\.external\?\.google === true/);
  assert.match(socialAuthSource, /settings\?\.external\?\.azure === true/);
  assert.match(socialAuthSource, /window\.CloudSync\.saveSession\(session\)/);
  assert.match(socialAuthSource, /await window\.CloudSync\.activate\(\)/);
  assert.doesNotMatch(socialAuthSource, /service_role|client_secret|secret key/i);
});

test('confirmação, recuperação, convites e login social retornam ao domínio oficial', () => {
  assert.match(appSource, /function canonicalAppEntryUrl/);
  assert.match(appSource, /https:\/\/obraativa\.com\.br\//);
  assert.match(appSource, /emailRedirectTo:this\.authReturnUrl\(\)/);
  assert.match(appSource, /passwordRecoveryRedirectUrl\(\)\{return canonicalAppEntryUrl\(\)\}/);
  assert.match(appSource, /return canonicalAppEntryUrl\(params\)/);
  assert.doesNotMatch(appSource, /emailRedirectTo:location\.origin\+location\.pathname/);
  assert.match(serviceWorkerSource, /CACHE_VERSION = 'v67'/);
  assert.match(serviceWorkerSource, /NETWORK_FIRST_ASSETS[\s\S]*?'\/public-assets\/obraativa-social-auth-v1\.js'/);
});

test('recepção mantém experiência horizontal responsiva e acessível', () => {
  assert.match(receptionStyle, /orientation:landscape/);
  assert.match(receptionStyle, /max-height:680px/);
  assert.match(receptionStyle, /max-height:500px/);
  assert.match(receptionStyle, /prefers-reduced-motion/);
  assert.match(receptionStyle, /overflow:auto/);
  assert.match(receptionSource, /aria-disabled/);
  assert.match(receptionSource, /aria-label/);
});

test('feedback, acessibilidade e responsividade permanecem na camada visual', () => {
  for (const token of ['aria-live', 'aria-busy', 'aria-labelledby', 'role', 'labelInputs']) assert.match(source, new RegExp(token));
  assert.match(style, /body:has\(#cloudGate\)\{overflow:hidden\}/);
  assert.match(style, /min-height:50px/);
  assert.match(style, /focus-visible/);
  assert.match(style, /orientation:landscape/);
  assert.match(style, /max-height:600px/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /grid-column:1\/-1;width:100%/);
});

test('login, cadastro e dados básicos informam corretamente o preenchimento automático', () => {
  assert.match(source, /function improveAutofill\(card, mode\)/);
  for (const token of ["autocomplete: 'email'", "'current-password'", "'new-password'", "autocomplete: 'organization'", "autocomplete: 'name'", "autocomplete: 'tel'", "autocomplete: 'address-level2'"]) {
    assert.ok(source.includes(token), `atributo de preenchimento ausente: ${token}`);
  }
  assert.match(source, /improveAutofill\(card, mode\)/);
});
