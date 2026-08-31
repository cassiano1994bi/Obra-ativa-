/* Página pública de uma proposta. Não exige login e não recebe chave secreta. */
(() => {
  const SUPABASE_URL = 'https://vqwxvsasmybwpeqiyzmd.supabase.co';
  const ANON_KEY = 'sb_publishable_vMwHLNZ-701PG7kCWR7azw_faYVZyCj';
  const app = document.getElementById('proposalApp');
  const token = new URLSearchParams(location.search).get('t') || '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const date = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Não definida';
  const lines = (value) => String(value || '').split(/\n|;/).map((part) => part.trim()).filter(Boolean);
  const list = (value) => lines(value).length ? `<ul>${lines(value).map((part) => `<li>${esc(part)}</li>`).join('')}</ul>` : '<p class="muted">Não informado.</p>';

  function styles() {
    document.head.insertAdjacentHTML('beforeend', `<style>
      :root{--blue:#123f76;--ink:#162a43;--soft:#eef4fb;--line:#d7e2ee;--gold:#e8ad28;--green:#1f8a4c;--amber:#a66a00;--red:#a53d48}*{box-sizing:border-box}body{margin:0;background:#eff4f9;color:var(--ink);font:16px/1.55 Inter,Arial,sans-serif}button,input,textarea{font:inherit}button{cursor:pointer}.shell{width:min(920px,calc(100% - 28px));margin:32px auto 60px}.head{background:var(--blue);color:#fff;border-bottom:5px solid var(--gold);padding:27px 30px;border-radius:17px 17px 0 0}.head small{font-size:11px;font-weight:800;letter-spacing:.08em}.head h1{margin:5px 0 0;font-size:clamp(24px,4vw,37px);line-height:1.08}.paper{background:#fff;border:1px solid var(--line);padding:30px;border-radius:0 0 17px 17px;box-shadow:0 15px 40px #1d426014}.tag{display:inline-block;padding:5px 10px;border-radius:99px;background:#eff7f0;color:#28683d;font-size:12px;font-weight:800}.summary{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:25px 0}.summary article{border:1px solid var(--line);padding:15px;border-radius:12px;background:#fbfdff}.summary small{display:block;color:#627a97;font-size:11px;font-weight:800;letter-spacing:.05em}.summary b{font-size:18px}.price{margin:23px 0;padding:22px;background:var(--blue);color:#fff;text-align:center;border-radius:14px}.price small{display:block;font-weight:800;letter-spacing:.06em}.price strong{font-size:clamp(30px,5vw,45px)}h2{font-size:20px;margin:29px 0 9px;color:var(--blue)}p{margin:8px 0}ul{margin:8px 0;padding-left:22px}.muted{color:#627a97}.response{margin-top:30px;padding:23px;border-radius:14px;background:var(--soft);border:1px solid var(--line)}.response h2{margin-top:0}.form-grid{display:grid;gap:12px}.field label{display:block;margin-bottom:5px;font-size:13px;font-weight:750}.field input,.field textarea{width:100%;border:1px solid #afc3d9;border-radius:9px;padding:11px;background:#fff}.field textarea{min-height:88px;resize:vertical}.check{display:flex;gap:9px;align-items:flex-start;font-size:13px}.check input{margin-top:5px;accent-color:var(--blue)}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.btn{border:0;border-radius:9px;padding:11px 15px;font-weight:800;background:var(--blue);color:#fff}.btn.alt{background:#fff;color:var(--blue);border:1px solid #98b1ca}.btn.danger{background:#fff;color:var(--red);border:1px solid #e4b3ba}.notice{margin-top:13px;font-size:13px;color:#5a6f86}.success,.error{margin:26px auto;max-width:620px;padding:30px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 15px 40px #1d426014}.success b{display:block;font-size:25px;color:var(--green)}.error b{display:block;font-size:22px;color:var(--red)}footer{color:#657b95;text-align:center;font-size:12px;margin-top:17px}@media(max-width:620px){.shell{width:min(100% - 18px,920px);margin-top:10px}.head,.paper{padding:22px 18px}.summary{grid-template-columns:1fr}.actions .btn{width:100%}}
    </style>`);
  }

  async function call(name, body) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) throw new Error(data?.message || data?.error || 'Esta proposta não está disponível. Solicite uma nova versão à construtora.');
    return data;
  }

  function unavailable(message) {
    app.innerHTML = `<section class="error"><b>Proposta indisponível</b><p>${esc(message || 'Solicite uma nova versão à construtora.')}</p></section>`;
  }

  function render(quote) {
    document.title = `${quote.number || 'Proposta'} · ${quote.companyName || 'Construtora'}`;
    const answer = quote.status === 'Aprovado' ? 'Esta proposta já foi aprovada.' : quote.status === 'Alterações solicitadas' ? 'Você já enviou um pedido de alteração.' : quote.status === 'Recusado' ? 'Você já registrou que não aprova esta proposta.' : '';
    app.innerHTML = `<div class="shell"><header class="head"><small>${esc(quote.companyName || 'CONSTRUTORA')}</small><h1>${esc(quote.title || 'Orçamento de execução de obra')}</h1></header><article class="paper"><span class="tag">PROPOSTA PARA AVALIAÇÃO</span><h2>${esc(quote.number || 'Orçamento')} · Versão ${esc(quote.version || 1)}</h2><p>${esc(quote.description || '')}</p><section class="summary"><article><small>VALIDADE</small><b>${esc(date(quote.validUntil))}</b></article><article><small>FORMA DE PAGAMENTO</small><b>${esc(quote.paymentTerms || 'Conforme proposta')}</b></article></section><section class="price"><small>VALOR TOTAL DA PROPOSTA</small><strong>${esc(money(quote.value))}</strong></section><h2>Serviços incluídos</h2>${list(quote.included)}<h2>Serviços não incluídos</h2>${list(quote.excluded)}<h2>Responsabilidades e condições</h2><p>${esc(quote.responsibilities || 'Conforme condições descritas pela construtora.')}</p>${answer ? `<section class="success"><b>${esc(answer)}</b><p>Registrado em ${esc(quote.respondedAt ? new Date(quote.respondedAt).toLocaleString('pt-BR') : 'data anterior')}.</p></section>` : responseForm()}</article><footer>Esta página é uma resposta comercial da proposta. Dúvidas ou alterações devem ser alinhadas com a construtora.</footer></div>`;
    bindForm();
  }

  function responseForm() { return `<section class="response"><h2>Responder à proposta</h2><p>Depois de enviar, a construtora verá sua resposta automaticamente no painel.</p><form id="proposalResponse" class="form-grid"><input type="hidden" name="decision"><div class="field"><label for="signer">Seu nome completo</label><input id="signer" name="signer" autocomplete="name" minlength="3" maxlength="160" required></div><div class="field"><label for="notes">Mensagem ou pedido de alteração <span class="muted">(opcional)</span></label><textarea id="notes" name="notes" maxlength="1200" placeholder="Escreva aqui se quiser enviar uma observação."></textarea></div><label class="check"><input type="checkbox" name="consent" required><span>Li esta proposta e confirmo que esta é minha resposta comercial.</span></label><div class="actions"><button class="btn" type="submit" data-decision="approved">Aprovar proposta</button><button class="btn alt" type="submit" data-decision="revision_requested">Pedir alterações</button><button class="btn danger" type="submit" data-decision="rejected">Não aprovar</button></div><p class="notice" id="responseMessage"></p></form></section>`; }

  function bindForm() {
    const form = document.getElementById('proposalResponse'); if (!form) return;
    form.addEventListener('click', (event) => { const button = event.target.closest('[data-decision]'); if (button) form.elements.decision.value = button.dataset.decision; });
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (!form.reportValidity()) return;
      const decision = form.elements.decision.value || 'approved'; const message = document.getElementById('responseMessage');
      const labels = { approved: 'aprovar', revision_requested: 'pedir alterações em', rejected: 'não aprovar' };
      if (!confirm(`Confirma que deseja ${labels[decision]} esta proposta? Essa resposta será enviada à construtora.`)) return;
      qa('button', form).forEach((button) => { button.disabled = true; }); message.textContent = 'Enviando sua resposta…';
      try {
        const response = await call('budget_public_respond', { p_token: token, p_decision: decision, p_signer_name: form.elements.signer.value.trim(), p_notes: form.elements.notes.value.trim(), p_consent: form.elements.consent.checked });
        app.innerHTML = `<section class="success"><b>Resposta enviada</b><p>${esc(response.status || 'A construtora recebeu sua resposta.')}</p><p>A atualização já aparece no painel da construtora.</p></section>`;
      } catch (error) { qa('button', form).forEach((button) => { button.disabled = false; }); message.textContent = error?.message || 'Não foi possível enviar agora.'; }
    });
  }

  async function start() {
    styles();
    if (!/^[a-f0-9]{64}$/i.test(token)) return unavailable();
    try { render(await call('budget_public_snapshot', { p_token: token })); } catch (error) { unavailable(error?.message); }
  }
  start();
})();
