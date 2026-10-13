/* GS Associates — "Start your project" brief
   The visitor's choices write a ready-to-send WhatsApp / e-mail message. */
(() => {
  const root = document.querySelector('[data-cta]');
  if (!root) return;
  const form = root.querySelector('[data-brief]');
  const wa = root.querySelector('[data-brief-wa]');
  const mail = root.querySelector('[data-brief-mail]');

  const PHONE = '916280986491';
  const EMAIL = 'gsassociates.biz@gmail.com';

  function update() {
    const fd = new FormData(form);
    const val = (k) => (fd.get(k) || '').toString().trim();
    const building = val('building') || 'Residential';
    const services = fd.getAll('service');

    const text = [
      'Hello GS Associates! I would like to start a project.',
      '',
      `Building: ${building}`,
      val('plot') ? `Plot size: ${val('plot')}` : null,
      val('vastu') ? `Vastu: ${val('vastu')}` : null,
      val('concept') ? `Concept: ${val('concept')}` : null,
      `Services: ${services.length ? services.join(', ') : 'Not sure yet, please advise'}`,
      val('name') ? `Name: ${val('name')}` : null,
      val('phone') ? `Phone: ${val('phone')}` : null,
    ].filter((l) => l !== null).join('\n');
    wa.href = `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
    mail.href = `mailto:${EMAIL}?subject=${encodeURIComponent(`New project: ${building}`)}&body=${encodeURIComponent(text)}`;
  }

  form.addEventListener('change', update);
  form.addEventListener('input', (e) => { if (e.target.name === 'name' || e.target.name === 'phone') update(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); wa.click(); });
  update();
})();
