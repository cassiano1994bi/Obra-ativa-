(() => {
  'use strict';

  window.ObraAtivaReceptionConfig = Object.freeze({
    socialProof: Object.freeze({
      verified: false,
      items: Object.freeze([
        Object.freeze({ value: '+2.500', label: 'Usuários ativos', icon: 'users' }),
        Object.freeze({ value: '+1.200', label: 'Obras gerenciadas', icon: 'works' }),
        Object.freeze({ value: '98%', label: 'Satisfação', icon: 'chart' })
      ])
    }),
    stores: Object.freeze({
      apple: Object.freeze({ status: 'coming_soon', url: '' }),
      googlePlay: Object.freeze({ status: 'coming_soon', url: '' })
    })
  });
})();
