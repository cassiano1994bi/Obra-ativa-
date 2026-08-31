(() => {
  'use strict';

  function sessionEmail() {
    return String(window.CloudSync?.session?.user?.email || '').trim().toLowerCase();
  }

  function installSettingsEntry() {
    const originalOpenModal = window.openModal;
    if (typeof originalOpenModal !== 'function' || originalOpenModal.accountDeletionWrapped) return;
    const wrapped = function wrappedOpenModal(type, id) {
      originalOpenModal(type, id);
      if (type !== 'settings') return;
      const dialog = document.getElementById('dialog');
      const footer = dialog?.querySelector('footer');
      if (!dialog || !footer || dialog.querySelector('[data-account-deletion-entry]')) return;
      footer.insertAdjacentHTML('beforebegin', `<section class="wide notice" data-account-deletion-entry style="margin-top:14px"><b>Privacidade e conta</b><p style="margin:6px 0 10px">Você pode solicitar a exclusão da sua conta. Nenhum dado empresarial será apagado automaticamente.</p><button class="btn alt sm" type="button" onclick="openAccountDeletionRequest()">Solicitar exclusão da minha conta</button> <a class="btn alt sm" href="/privacidade.html" target="_blank" rel="noopener">Política de privacidade</a></section>`);
    };
    wrapped.accountDeletionWrapped = true;
    window.openModal = wrapped;
  }

  window.openAccountDeletionRequest = function openAccountDeletionRequest() {
    const dialog = document.getElementById('dialog');
    const email = sessionEmail();
    if (!dialog) return;
    dialog.innerHTML = `<h2>Solicitar exclusão da conta</h2><p class="sub">A solicitação será analisada com confirmação de identidade. Nenhum dado será apagado automaticamente.</p><form class="form" id="accountDeletionInAppForm"><div class="field"><label>E-mail da conta</label><input name="email" type="email" required value="${email.replace(/"/g, '&quot;')}" ${email ? 'readonly' : ''}></div><div class="field wide"><label>Observação opcional</label><textarea name="reason" maxlength="800" placeholder="Se desejar, explique o motivo."></textarea></div><label class="check-line wide"><input name="confirm" type="checkbox" required> Entendo que a solicitação poderá encerrar meu acesso após a confirmação.</label></form><div class="notice" id="accountDeletionInAppStatus" hidden></div><footer><a class="btn alt" href="/exclusao-de-conta.html" target="_blank" rel="noopener">Abrir página externa</a><button class="btn alt" type="button" onclick="closeModal()">Cancelar</button><button class="btn" type="button" onclick="submitAccountDeletionRequest()">Enviar solicitação</button></footer>`;
    document.getElementById('modal')?.classList.add('show');
  };

  window.submitAccountDeletionRequest = async function submitAccountDeletionRequest() {
    const form = document.getElementById('accountDeletionInAppForm');
    const status = document.getElementById('accountDeletionInAppStatus');
    if (!form || !status || !form.reportValidity()) return;
    const sendButton = [...document.querySelectorAll('#dialog footer button')].find((button) => button.textContent.includes('Enviar'));
    if (sendButton) sendButton.disabled = true;
    status.hidden = false;
    status.textContent = 'Enviando sua solicitação...';
    try {
      const values = Object.fromEntries(new FormData(form));
      const token = window.CloudSync?.session?.access_token || '';
      const response = await fetch('/.netlify/functions/request-account-deletion', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ email: values.email, reason: values.reason, source: 'in-app' })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível enviar agora.');
      status.textContent = `Solicitação ${body.requestId || ''} recebida. Verifique seu e-mail para continuar a confirmação.`.trim();
      if (sendButton) sendButton.remove();
    } catch (error) {
      status.textContent = `${error.message || 'Não foi possível enviar.'} Você também pode usar a página externa.`;
      if (sendButton) sendButton.disabled = false;
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSettingsEntry, { once: true });
  else installSettingsEntry();
})();
