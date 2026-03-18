// Notification sound using Web Audio API — no external file needed
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playNotificationSound(type: 'message' | 'alert' = 'alert') {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'message') {
      // Short pleasant two-tone chime for messages
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);        // A5
      oscillator.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1); // D6
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } else {
      // Three-tone alert for notifications
      oscillator.frequency.setValueAtTime(659.25, ctx.currentTime);      // E5
      oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12); // G5
      oscillator.frequency.setValueAtTime(987.77, ctx.currentTime + 0.24); // B5
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.18, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.45);
    }
  } catch (e) {
    // Audio not available — fail silently
  }
}
