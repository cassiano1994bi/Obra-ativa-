(() => {
  'use strict';
  const form = document.getElementById('accountDeletionPublicForm');
  const status = document.getElementById('accountDeletionPublicStatus');
  if (!form || !status) return;

  function show(message, error = false) {
    status.textContent = message;
    status.classList.add('show');
    status.classList.toggle('error', error);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    show('Enviando sua solicitação...');
    try {
      const values = Object.fromEntries(new FormData(form));
      const response = await fetch('/.netlify/functions/request-account-deletion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          reason: values.reason,
          website: values.website,
          source: 'public-web'
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível enviar agora.');
      form.reset();
      show(`Solicitação ${body.requestId || ''} recebida. Verifique seu e-mail para continuar a confirmação.`.trim());
    } catch (error) {
      show(`${error.message || 'Não foi possível enviar.'} Você também pode escrever para escritoriodaminhaobra@gmail.com.`, true);
    } finally {
      button.disabled = false;
    }
  });
})();
