import gsap from 'gsap';

// Staggered card entrance animation
export function animateCardStagger(containerSelector, cardClass = '.gsap-card', delay = 0.1) {
  if (typeof window === 'undefined') return;
  const cards = document.querySelectorAll(cardClass);
  if (!cards || cards.length === 0) return;

  gsap.fromTo(
    cards,
    { opacity: 0, y: 24, scale: 0.98 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.5,
      stagger: 0.08,
      ease: 'power3.out',
      delay: delay
    }
  );
}

// Number rollup animation for KPIs
export function animateNumberRollup(targetRef, endVal, prefix = '', suffix = '', duration = 1.2) {
  if (!targetRef || isNaN(endVal)) return;

  const obj = { val: 0 };
  gsap.to(obj, {
    val: endVal,
    duration: duration,
    ease: 'power2.out',
    onUpdate: () => {
      if (targetRef) {
        const formatted = Math.round(obj.val).toLocaleString();
        targetRef.innerText = `${prefix}${formatted}${suffix}`;
      }
    }
  });
}

// Modal open elastic/smooth zoom
export function animateModalOpen(element) {
  if (!element) return;
  gsap.fromTo(
    element,
    { opacity: 0, scale: 0.92, y: 15 },
    { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.5)' }
  );
}

// Smooth pulse effect for active widgets
export function animatePulse(element) {
  if (!element) return;
  gsap.to(element, {
    scale: 1.05,
    repeat: 1,
    yoyo: true,
    duration: 0.25,
    ease: 'power1.inOut'
  });
}
