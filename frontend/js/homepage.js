/* ==============================
   GigShield — script.js
   ============================== */

// ── Navbar scroll effect ──────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// ── Mobile hamburger toggle ───────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const navLinks  = document.querySelector('.nav-links');
const navCta    = document.querySelector('.nav-cta');

hamburger.addEventListener('click', () => {
  const open = hamburger.classList.toggle('active');
  // Slide nav links + CTA into view on mobile
  if (open) {
    injectMobileMenu();
  } else {
    removeMobileMenu();
  }
});

function injectMobileMenu() {
  let mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenu) { mobileMenu.style.display = 'flex'; return; }

  mobileMenu = document.createElement('div');
  mobileMenu.id = 'mobile-menu';
  Object.assign(mobileMenu.style, {
    position: 'fixed',
    top: '68px',
    left: '0',
    width: '100%',
    background: 'rgba(5,14,24,0.97)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(0,255,209,0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    zIndex: '998',
    animation: 'slideDown 0.3s ease',
  });

  const links = ['#features', '#how', '#plans', '#testimonials'];
  const labels = ['Features', 'How It Works', 'Plans', 'Reviews'];

  links.forEach((href, i) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = labels[i];
    Object.assign(a.style, {
      padding: '16px 24px',
      color: '#7a9ab5',
      fontFamily: 'Syne, sans-serif',
      fontWeight: '600',
      borderBottom: '1px solid rgba(0,255,209,0.07)',
      transition: 'color 0.2s',
      fontSize: '1rem',
    });
    a.addEventListener('mouseover', () => a.style.color = '#00FFD1');
    a.addEventListener('mouseout', () => a.style.color = '#7a9ab5');
    a.addEventListener('click', () => {
      hamburger.classList.remove('active');
      mobileMenu.style.display = 'none';
    });
    mobileMenu.appendChild(a);
  });

  // CTA row
  const ctaRow = document.createElement('div');
  Object.assign(ctaRow.style, {
    display: 'flex',
    gap: '12px',
    padding: '18px 24px',
  });

  const btnView = document.createElement('a');
  btnView.href = '#plans';
  btnView.textContent = 'View Plans';
  Object.assign(btnView.style, {
    flex: '1', padding: '12px', textAlign: 'center',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#e8f4ff',
    fontFamily: 'Syne, sans-serif', fontWeight: '600', cursor: 'pointer',
  });

  const btnStart = document.createElement('a');
  btnStart.href = '#plans';
  btnStart.textContent = 'Get Started';
  Object.assign(btnStart.style, {
    flex: '1', padding: '12px', textAlign: 'center',
    background: 'linear-gradient(135deg, #00FFD1, #0094FF)',
    borderRadius: '8px', color: '#050e18',
    fontFamily: 'Syne, sans-serif', fontWeight: '700', cursor: 'pointer',
  });

  ctaRow.appendChild(btnView);
  ctaRow.appendChild(btnStart);
  mobileMenu.appendChild(ctaRow);

  document.body.appendChild(mobileMenu);

  // Inject keyframe animation if not present
  if (!document.getElementById('slide-down-style')) {
    const style = document.createElement('style');
    style.id = 'slide-down-style';
    style.textContent = `@keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }`;
    document.head.appendChild(style);
  }
}

function removeMobileMenu() {
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenu) mobileMenu.style.display = 'none';
}

// Close mobile menu on outside click
document.addEventListener('click', (e) => {
  if (!navbar.contains(e.target)) {
    hamburger.classList.remove('active');
    removeMobileMenu();
  }
});

// ── Scroll animation observer ─────────────────────────────────────
const animateEls = document.querySelectorAll('[data-animate]');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const delay = parseInt(el.dataset.delay || '0', 10);
    setTimeout(() => el.classList.add('visible'), delay);
    observer.unobserve(el);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

animateEls.forEach(el => observer.observe(el));

// ── Staggered features & steps ───────────────────────────────────
document.querySelectorAll('.feature-card, .plan-card, .testimonial-card, .step').forEach((el, i) => {
  if (!el.hasAttribute('data-delay')) {
    el.setAttribute('data-delay', String(i * 80));
  }
});

// ── Smooth anchor scroll with offset for fixed nav ───────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = navbar.offsetHeight + 16;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// ── Hero floating card shimmer on hover ──────────────────────────
document.querySelectorAll('.floating-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    card.style.borderColor = 'rgba(0,255,209,0.5)';
    card.style.boxShadow = '0 0 20px rgba(0,255,209,0.2), 0 4px 24px rgba(0,0,0,0.4)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.borderColor = '';
    card.style.boxShadow = '';
  });
});

// ── Plan card highlight on hover ─────────────────────────────────
document.querySelectorAll('.plan-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    document.querySelectorAll('.plan-card').forEach(c => {
      if (c !== card && !c.classList.contains('plan-featured')) {
        c.style.opacity = '0.6';
      }
    });
  });
  card.addEventListener('mouseleave', () => {
    document.querySelectorAll('.plan-card').forEach(c => c.style.opacity = '');
  });
});

// ── Step number counter animation ────────────────────────────────
const stepNums = document.querySelectorAll('.step-num');
const stepObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    el.style.transition = 'background 0.5s, box-shadow 0.5s';
    el.style.background = 'rgba(0,255,209,0.08)';
    el.style.boxShadow = '0 0 0 8px rgba(0,255,209,0.06), 0 0 20px rgba(0,255,209,0.2)';
    setTimeout(() => {
      el.style.background = '';
      el.style.boxShadow = '';
    }, 1200);
    stepObserver.unobserve(el);
  });
}, { threshold: 0.5 });

stepNums.forEach(n => stepObserver.observe(n));

// ── Badge glow pulse on load ──────────────────────────────────────
setTimeout(() => {
  const badge = document.querySelector('.hero-badge');
  if (badge) {
    badge.style.transition = 'box-shadow 0.4s';
    badge.style.boxShadow = '0 0 20px rgba(0,255,209,0.25)';
    setTimeout(() => badge.style.boxShadow = '', 1000);
  }
}, 800);

// ── Parallax hero orbs on mouse move ─────────────────────────────
const heroSection = document.querySelector('.hero');
if (heroSection) {
  heroSection.addEventListener('mousemove', (e) => {
    const rect = heroSection.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;

    const orb1 = document.querySelector('.orb-1');
    const orb2 = document.querySelector('.orb-2');
    const orb3 = document.querySelector('.orb-3');

    if (orb1) orb1.style.transform = `translate(${x * 30}px, ${y * 20}px)`;
    if (orb2) orb2.style.transform = `translate(${-x * 20}px, ${-y * 15}px)`;
    if (orb3) orb3.style.transform = `translate(${x * 15}px, ${y * 25}px)`;
  });
}

// ── Tilt effect on feature cards ─────────────────────────────────
document.querySelectorAll('.feature-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    card.style.transform = `translateY(-4px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

// ── Testimonial card entrance with typewriter feel ───────────────
// (They're handled via the intersection observer above)

console.log('%cGigShield ⚡ Loaded', 'color: #00FFD1; font-family: Syne, sans-serif; font-size: 14px; font-weight: 700;');

// ── Fix: Scroll to section when coming from another page (#plans etc.) ──
window.addEventListener("load", () => {
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      const offset = navbar.offsetHeight + 16;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;

      setTimeout(() => {
        window.scrollTo({ top, behavior: "smooth" });
      }, 100);
    }
  }
});