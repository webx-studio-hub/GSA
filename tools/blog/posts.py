# Blog posts for gen_blog.py. Newest first; the first post is featured on blog.html.
# To add a post: add an entry at the top of POSTS (body is plain HTML: <h2>, <p>, <ul>, <blockquote>, <figure>;
# add featured=True to show it in the Blog menus, otherwise the three newest are shown),
# then run:  python3 tools/blog/gen_blog.py
# These four starter articles are general advice written for the launch; have the client review them.
CATEGORIES = ['Planning', 'Construction', 'Interiors', 'Design']
POSTS = [
 dict(slug='plan-your-new-home', category='Planning', date='2026-09-28',
  title='Planning a new home? Seven steps from plot to keys',
  seo_title='Planning a New Home in Ludhiana: 7 Steps from Plot to Keys | GS Associates',
  seo_desc='Building a home in Punjab? Follow these seven steps, from checking your plot and budget to design, approvals, construction and handover, to avoid costly surprises.',
  excerpt='Building a home is one of the biggest decisions a family makes. These seven steps keep it calm, clear and on budget.',
  image='assets/img/projects/manor-4.webp', image_alt='Aerial view of a family home with landscaped gardens', pos='50% 55%',
  body='''
<p>Building your own home is exciting, but it can also feel overwhelming. There are hundreds of decisions to make, and the order you make them in matters. Get the sequence right and the whole project feels calm. Get it wrong and you pay for it twice, in time and in money.</p>
<p>Here is the path we recommend to every family who comes to us, whether they are building a compact family house or a large villa.</p>
<h2>1. Understand your plot</h2>
<p>Before you think about rooms and finishes, look closely at the land. Which way does it face? Where does the sun rise and set? How wide is the road, and where will the entrance go? Are there neighbouring buildings that will block light or overlook your garden?</p>
<p>A short site study answers these questions and often changes the whole design for the better, for example by moving the living room to catch winter sun or placing bedrooms away from a busy road.</p>
<figure><img src="assets/img/work/house-timber-gate.webp" alt="A modern home with a timber gate and planted entrance" loading="lazy" decoding="async"><figcaption>Where the entrance, parking and garden go is decided by the plot, long before the facade.</figcaption></figure>
<h2>2. Set a realistic budget, with a buffer</h2>
<p>Decide on an overall figure, then split it roughly between structure, finishes and interiors. Always keep a contingency of 10 to 15 percent for the unexpected. It is far easier to spend a buffer at the end than to find money halfway through.</p>
<h2>3. Write down how you live</h2>
<p>Make a simple list: who lives in the house, who visits often, how you cook, where you like to sit in the evening, how much storage you need. This brief is the most useful thing you can give your architect.</p>
<ul>
  <li>How many bedrooms and bathrooms, now and in ten years?</li>
  <li>Do parents or guests need a ground-floor room?</li>
  <li>Do you need a home office, a prayer room or a study area?</li>
  <li>How many cars, and do you want a covered porch?</li>
</ul>
<h2>4. Design, and see it in 3D</h2>
<p>Plans are hard to read for most people. Ask for 3D views of the outside and the main rooms, so you can see proportions, light and materials before anything is built. Changing a drawing costs nothing; changing a wall costs a lot.</p>
<blockquote>Changing a drawing costs nothing. Changing a wall costs a lot.</blockquote>
<figure><img src="assets/img/projects/refined-5.webp" alt="A hand-drawn concept sketch of a bedroom" loading="lazy" decoding="async"><figcaption>A concept sketch lets the whole family picture a room before anything is built.</figcaption></figure>
<h2>5. Get the drawings and approvals in order</h2>
<p>Detailed working and structural drawings tell the site team exactly what to build. They are also needed for building plan approval from your local authority. Starting construction before approvals are in place is one of the most common, and most expensive, mistakes.</p>
<h2>6. Build with regular check-ins</h2>
<p>During construction, agree on a simple rhythm of updates: photos from site, a short weekly call and a visit at key stages such as the foundation, the roof slab and before plastering. Checking work at the right moment is much easier than fixing it later.</p>
<figure><img src="assets/img/work/villa-classical.webp" alt="A finished classical villa with columns and balconies" loading="lazy" decoding="async"><figcaption>Checks at the foundation, slab and plaster stages keep quality on track all the way to the finish.</figcaption></figure>
<h2>7. Finish, check and move in</h2>
<p>Before handover, walk through every room with a checklist: doors and windows, electrical points, plumbing, tiles and paint. Small fixes are quick while the team is still on site.</p>
<p>Planning a new home and not sure where to start? <a href="contact.html">Talk to our team</a>. A first conversation is the easiest step of all.</p>
'''),
 dict(slug='architect-and-builder-under-one-roof', category='Construction', date='2026-09-14',
  title='Architect, contractor or both? Why one team makes building easier',
  seo_title='Architect vs Contractor: Why One Design-Build Team Is Easier | GS Associates',
  seo_desc='Should you hire an architect and a contractor separately, or one team that designs and builds? The pros, the pitfalls and how to decide for your home or office.',
  excerpt='Hiring a designer and a builder separately is common. Here is what changes when one team does both, and when it makes sense.',
  image='assets/img/work/house-gabled.webp', image_alt='A modern home with gabled roofs and timber panels', pos='50% 60%',
  body='''
<p>Most people who build a home in India hire an architect for the drawings and a separate contractor for the construction. It works, but it also creates a gap between the two, and that gap is where many problems start.</p>
<h2>The gap between drawing and building</h2>
<p>When design and construction are handled by different people, every question on site has to travel back and forth. Is this beam size correct? Can this window move by a foot? Who pays if the drawing and the site do not match? Each answer takes time, and sometimes the client ends up in the middle.</p>
<h2>What changes with one team</h2>
<p>A design-build team plans, draws and builds under one roof. The architects, engineers and site team talk every day, so problems are solved before they reach you.</p>
<ul>
  <li><strong>One point of contact.</strong> You call one person, not three.</li>
  <li><strong>Fewer surprises.</strong> The people who design it know what it will cost to build.</li>
  <li><strong>Faster decisions.</strong> Site questions are answered in hours, not weeks.</li>
  <li><strong>Clear responsibility.</strong> If something is not right, there is no one else to blame.</li>
</ul>
<blockquote>When the people who draw it also build it, the outside and the inside fit together.</blockquote>
<figure><img src="assets/img/projects/curve-1.webp" alt="The Contemporary Curve House street facade" loading="lazy" decoding="async"><figcaption>The Contemporary Curve House: designed, built and furnished by one team.</figcaption></figure>
<h2>When separate teams can still work</h2>
<p>If you already have an architect you trust, or a contractor you have worked with for years, keeping them is perfectly reasonable. In that case, invest in very detailed drawings and agree in writing who decides what on site.</p>
<figure><img src="assets/img/work/township-street.webp" alt="Aerial view of a landscaped commercial street" loading="lazy" decoding="async"><figcaption>Larger developments gain the most from one team coordinating design and site work.</figcaption></figure>
<h2>How to decide</h2>
<p>Ask yourself how much time you can spend coordinating. If you are busy, live in another city or simply want peace of mind, one team is usually the easier path. If you enjoy managing the details yourself, separate specialists can work well.</p>
<p>Want to understand what a single team would look like for your project? <a href="services.html">See how we work</a>, or <a href="contact.html">get in touch</a>.</p>
'''),
 dict(slug='warm-neutral-interiors', category='Interiors', date='2026-08-30',
  title='Warm neutrals: how to design a calm, timeless interior',
  seo_title='Warm Neutral Interior Design Ideas for a Calm, Timeless Home | GS Associates',
  seo_desc='Soft beiges, natural textures and hidden lighting: how to plan a warm neutral interior that feels calm, ages well and works for everyday family life.',
  excerpt='Soft colours, natural textures and layered light. A simple recipe for rooms that feel calm today and still look right in ten years.',
  image='assets/img/projects/refined-3.webp', image_alt='A calm living room in warm neutral tones with arched shelving', pos='50% 55%',
  body='''
<p>Trends come and go quickly in interior design. A warm neutral palette is one of the few approaches that stays beautiful for years, and it makes a busy family home feel restful.</p>
<h2>Start with a narrow palette</h2>
<p>Choose three or four related tones: a soft off-white for walls, a warm beige or greige for large surfaces, and one deeper shade such as walnut or clay for contrast. Keeping the palette narrow is what makes a room feel calm.</p>
<figure><img src="assets/img/projects/curve-3.webp" alt="A warm living and dining room in wood and beige" loading="lazy" decoding="async"><figcaption>Wood, beige and one deeper accent: a narrow palette that still feels rich.</figcaption></figure>
<h2>Add texture instead of colour</h2>
<p>A neutral room can feel flat if every surface is smooth. Bring in texture to keep it interesting:</p>
<ul>
  <li>Natural stone or textured plaster on a feature wall</li>
  <li>Wood with a visible grain on shelves, doors or a TV wall</li>
  <li>Linen, boucle or jute for sofas, curtains and rugs</li>
  <li>Fluted panels or rounded edges for softness</li>
</ul>
<figure><img src="assets/img/projects/refined-2.webp" alt="A bedroom with curved shelving and hidden lighting" loading="lazy" decoding="async"><figcaption>Curved shelving and hidden lighting soften a neutral bedroom.</figcaption></figure>
<h2>Layer the lighting</h2>
<p>Lighting changes neutral colours more than anything else. Plan three layers: soft general light from the ceiling, hidden strip lights in shelves, coves and under steps, and a few warm lamps at eye level. Warm white bulbs keep beige and wood tones cosy rather than grey.</p>
<blockquote>In a neutral room, light does the work that colour usually does.</blockquote>
<h2>Keep it practical</h2>
<p>Neutral does not have to mean fragile. Choose washable paints, stain-resistant fabrics and darker tones on floors and lower surfaces that see the most use. Built-in storage keeps clutter out of sight, which matters more in a calm room than in a colourful one.</p>
<figure><img src="assets/img/work/kitchen-arch.webp" alt="A kitchen with an arched opening, stone and warm wood" loading="lazy" decoding="async"><figcaption>Durable stone and wood finishes keep a neutral kitchen practical for everyday cooking.</figcaption></figure>
<h2>Bring it to life</h2>
<p>Finish with plants, books and a few personal pieces. They add warmth and make the space feel like yours rather than a showroom.</p>
<p>Planning your interiors? <a href="interiors.html">See our interior design service</a> or <a href="refined-living.html">look inside a calm, neutral home</a> we designed.</p>
'''),
 dict(slug='sketch-before-you-build', category='Design', date='2026-08-12',
  title='From sketch to reality: why we draw every room before we build it',
  seo_title='Why Sketches and 3D Views Matter Before You Build | GS Associates',
  seo_desc='Hand sketches and 3D views let you see your home before a single brick is laid. Why drawing every room first saves money and leads to better spaces.',
  excerpt='A quick hand sketch or a 3D view can save weeks on site. Here is why we draw every important room before work begins.',
  image='assets/img/projects/refined-4.webp', image_alt='A hand-drawn concept sketch of a curved staircase', pos='50% 55%',
  body='''
<p>Many problems in a finished home can be traced back to one moment: a decision that was made on site, in a hurry, without a drawing. Sketching first is the simplest way to avoid that.</p>
<h2>Seeing is easier than imagining</h2>
<p>Most people find it hard to picture a room from a floor plan. A sketch or a 3D view shows the height of the ceiling, the curve of a staircase or how light falls across a wall. Suddenly everyone in the family is talking about the same room.</p>
<figure><img src="assets/img/projects/refined-6.webp" alt="A concept sketch of a couple relaxing in their living room" loading="lazy" decoding="async"><figcaption>Even a quick sketch shows scale, light and how a family will use a room.</figcaption></figure>
<h2>Changes on paper are free</h2>
<p>Moving a wall on paper takes a few minutes. Moving it on site means breaking work that is already done. The earlier a change happens, the cheaper it is.</p>
<figure class="figure-pair"><img src="assets/img/projects/refined-5.webp" alt="Concept sketch of a bedroom" loading="lazy" decoding="async"><img src="assets/img/projects/refined-2.webp" alt="The same bedroom, finished" loading="lazy" decoding="async"><figcaption>Sketch and finished room, side by side: the curved shelving and hidden lighting were set on paper first.</figcaption></figure>
<blockquote>The earlier a change happens, the cheaper it is.</blockquote>
<h2>What we draw before building</h2>
<ul>
  <li>The front of the house, from the street</li>
  <li>The main living and dining spaces</li>
  <li>Staircases and double-height areas</li>
  <li>Kitchens and wardrobes, where every centimetre counts</li>
  <li>Feature walls, ceilings and lighting ideas</li>
</ul>
<figure><img src="assets/img/projects/refined-1.webp" alt="The finished curved staircase with warm hidden lighting" loading="lazy" decoding="async"><figcaption>The same staircase, built: the sketch set the curve, the steps and the lighting.</figcaption></figure>
<h2>A shared picture for the whole team</h2>
<p>Drawings are not only for the client. They give the site team, carpenters and electricians one clear picture to work from, so the finished room matches what everyone agreed.</p>
<p>See it for yourself on our <a href="consultancy.html">consultancy page</a>, where you can drag a slider from the sketch to the finished room.</p>
'''),
]


def featured(n=3):
    """The articles shown in the Blog menus: posts marked featured=True first, topped up with the newest."""
    picked = [p for p in POSTS if p.get('featured')]
    return (picked + [p for p in POSTS if p not in picked])[:n]
