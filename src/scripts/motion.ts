import { gsap } from 'gsap'

export function initMotion() {
  const media = gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)', () => {
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
    intro.from('[data-title-line]', {
      yPercent: 106,
      rotation: 1,
      duration: 1,
      stagger: 0.1,
      clearProps: 'all',
    })
    intro.from(
      '[data-intro]',
      { y: 14, opacity: 0, duration: 0.8, clearProps: 'all' },
      0.2,
    )
  })
  return () => media.revert()
}
