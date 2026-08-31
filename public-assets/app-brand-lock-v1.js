(() => {
  'use strict';

  const APP_LOGO = 'public-assets/obraativa-app-icon-v2-192.png';

  function forceAppBrand() {
    document.querySelectorAll('#app:not(.public-app) .side .brand-logo, #app:not(.public-app) .top .obraativa-mobile-top-logo').forEach((image) => {
      const expectedAlt = image.classList.contains('brand-logo') ? 'ObraAtiva' : '';
      if (image.getAttribute('src') !== APP_LOGO) image.setAttribute('src', APP_LOGO);
      if (image.getAttribute('alt') !== expectedAlt) image.setAttribute('alt', expectedAlt);
      if (image.classList.contains('company-logo')) image.classList.remove('company-logo');
    });
  }

  window.applyCompanyLogo = forceAppBrand;

  window.openOfficeSettingsModal = function openOfficeSettingsWithoutCustomLogo() {
    const dialog = $('#dialog');
    dialog.innerHTML = `<h2>Configurações da empresa</h2><p class="sub">Ajuste os dados usados na rotina. A identidade visual permanece com a logo oficial do ObraAtiva.</p><form class="form" id="form">${field('company','Nome da empresa','text',db.settings.company||'',true)}${field('responsible','Responsável','text',db.settings.responsible||'')}${field('phone','WhatsApp da empresa','tel',db.settings.phone||'')}${field('salesWhatsapp','WhatsApp de atendimento','tel',db.settings.salesWhatsapp||PRODUCT_SALES_WHATSAPP_DEFAULT)}${field('cycleStart','Primeira sexta-feira do ciclo','date',db.settings.cycleStart||'',true)}<div class="field wide notice"><b>Identidade do aplicativo</b><br>A logo oficial do ObraAtiva é exibida de forma padronizada em todos os dispositivos.</div></form><footer><button class="btn alt" type="button" onclick="closeModal()">Cancelar</button><button class="btn" type="button" onclick="saveOfficeSettings()">Salvar configurações</button></footer>`;
    $('#modal').classList.add('show');
  };

  window.saveOfficeSettings = function saveOfficeSettingsWithoutCustomLogo() {
    const form = $('#form');
    if (!form || !form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    db.settings = {
      ...db.settings,
      company: values.company,
      responsible: values.responsible,
      phone: values.phone,
      salesWhatsapp: values.salesWhatsapp,
      cycleStart: values.cycleStart
    };
    ClientDataService.persist('Configurações alteradas', 'Dados básicos da empresa atualizados');
    closeModal();
    forceAppBrand();
    renderTop();
    render();
  };

  const observer = new MutationObserver(forceAppBrand);
  function install() {
    const app = document.getElementById('app');
    if (!app) return;
    forceAppBrand();
    observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
