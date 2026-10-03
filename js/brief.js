/* GS Associates — "Start your project" brief
   The visitor's choices write a ready-to-send WhatsApp / e-mail message. */
(() => {
  const root = document.querySelector('[data-cta]');
  if (!root) return;
  const form = root.querySelector('[data-brief]');
  const wa = root.querySelector('[data-brief-wa]');
  const mail = root.querySelector('[data-brief-mail]');

  const PHONE = '919814626056';
  const EMAIL = 'gsassociates.biz@gmail.com';
  const TYPES = { home: 'New home', renovation: 'Renovation', commercial: 'Office or shop', other: 'Something else' };

  function update() {
    const fd = new FormData(form);
    const type = TYPES[fd.get('type') || 'home'];
    const services = fd.getAll('service');
    const when = fd.get('when');
    const name = (fd.get('name') || '').toString().trim();

    const text = [
      'Hello GS Associates! I would like to start a project.',
      '',
      `Project: ${type}`,
      `Services: ${services.length ? services.join(', ') : 'Not sure yet, please advise'}`,
      when && `Start: ${when}`,
      name && `Name: ${name}`,
    ].filter((l) => l !== false && l !== null && l !== undefined).join('\n');
    wa.href = `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
    mail.href = `mailto:${EMAIL}?subject=${encodeURIComponent(`New project: ${type}`)}&body=${encodeURIComponent(text)}`;
  }

  form.addEventListener('change', update);
  form.addEventListener('input', (e) => { if (e.target.name === 'name') update(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); wa.click(); });
  update();
})();
