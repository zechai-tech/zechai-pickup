import confetti from 'canvas-confetti';

export function fireConfetti() {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.5 },
      colors: ['#CE5535', '#E8B125', '#2B1A12', '#2F7A3E', '#F4E7CC'],
    });
  } catch (e) {
    // Graceful fallback if window/canvas unavailable
  }
}
