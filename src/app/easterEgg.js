import confetti from 'canvas-confetti';

const EASTER_EGG_NAME = 'chen xu';
const EASTER_EGG_MAX_DURATION_MS = 9000;
let easterEggActive = false;
let easterEggCanvas = null;
let easterEggConfetti = null;
let easterEggAnimationFrame = null;
let easterEggInterval = null;
let easterEggEndAt = null;

function normalizeEasterEggInput(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function ensureEasterEggCanvas() {
    if (easterEggCanvas) return easterEggCanvas;
    const canvas = document.createElement('canvas');
    canvas.id = 'easterEggCanvas';
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
    easterEggCanvas = canvas;
    return canvas;
}

function stopEasterEgg() {
    if (!easterEggActive) return;
    easterEggActive = false;

    if (easterEggAnimationFrame) {
        cancelAnimationFrame(easterEggAnimationFrame);
        easterEggAnimationFrame = null;
    }
    if (easterEggInterval) {
        clearInterval(easterEggInterval);
        easterEggInterval = null;
    }
    if (easterEggConfetti) {
        easterEggConfetti.reset();
    }
    if (easterEggCanvas) {
        easterEggCanvas.remove();
        easterEggCanvas = null;
    }
}

function startEasterEgg() {
    if (easterEggActive) return;
    easterEggActive = true;
    const canvas = ensureEasterEggCanvas();
    easterEggConfetti = confetti.create(canvas, { resize: true, useWorker: true });
    easterEggEndAt = Date.now() + EASTER_EGG_MAX_DURATION_MS;

    const palette = ['#0B3954', '#087E8B', '#2B9EB3', '#8DD3C7', '#D7F2F6', '#2F6690', '#FFB703', '#FB8500'];

    // Opening burst
    easterEggConfetti({
        particleCount: 120,
        spread: 90,
        startVelocity: 55,
        origin: { x: 0.5, y: 0.2 },
        colors: palette
    });

    // Side cannons
    easterEggConfetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        startVelocity: 50,
        origin: { x: 0, y: 0.3 },
        colors: palette
    });
    easterEggConfetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        startVelocity: 50,
        origin: { x: 1, y: 0.3 },
        colors: palette
    });

    const driftLoop = () => {
        if (!easterEggActive) return;
        const timeLeft = easterEggEndAt - Date.now();
        if (timeLeft <= 0) {
            stopEasterEgg();
            return;
        }

        const progress = timeLeft / EASTER_EGG_MAX_DURATION_MS;
        const spread = 360 * (0.35 + 0.65 * (1 - progress));
        const velocity = 35 * (0.6 + 0.4 * (1 - progress));
        const count = Math.round(6 + 10 * (1 - progress));

        easterEggConfetti({
            particleCount: count,
            spread,
            startVelocity: velocity,
            scalar: 0.9,
            ticks: 200,
            origin: { x: Math.random(), y: Math.random() * 0.2 + 0.05 },
            colors: palette
        });

        easterEggAnimationFrame = requestAnimationFrame(driftLoop);
    };

    easterEggAnimationFrame = requestAnimationFrame(driftLoop);

    easterEggInterval = setInterval(() => {
        if (!easterEggActive) return;
        easterEggConfetti({
            particleCount: 45,
            spread: 70,
            startVelocity: 40,
            scalar: 1.1,
            origin: { x: 0.5, y: 0.6 },
            colors: palette
        });
    }, 900);
}

export function handleEasterEggInput(value) {
    const normalized = normalizeEasterEggInput(value);
    if (normalized === EASTER_EGG_NAME) {
        startEasterEgg();
    } else {
        stopEasterEgg();
    }
}
