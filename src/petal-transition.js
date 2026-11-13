const duration = 1080;
const turn = Math.PI * 2;
const spriteSize = 96;
const sprite = document.createElement("canvas");
sprite.width = sprite.height = spriteSize;
const artwork = new Image();
artwork.src = `${import.meta.env.BASE_URL}petal.svg`;
let spriteReady = false;
artwork
  .decode()
  .then(() => {
    sprite.getContext("2d").drawImage(artwork, 0, 0, spriteSize, spriteSize);
    spriteReady = true;
  })
  .catch(() => {});

const sample = document.createElement("canvas");
sample.width = sample.height = 40;
const sampler = sample.getContext("2d", { willReadFrequently: true });
const silhouettes = new WeakMap();

function silhouette(image) {
  if (silhouettes.has(image)) return silhouettes.get(image);
  if (!sampler || !image.naturalWidth) return [];

  sampler.clearRect(0, 0, 40, 40);
  sampler.drawImage(image, 0, 0, 40, 40);
  const pixels = sampler.getImageData(0, 0, 40, 40).data;
  const outline = [];
  const blooms = [];
  for (let y = 1; y < 39; y++) {
    for (let x = 1; x < 39; x++) {
      const alpha = (dx, dy) => pixels[((y + dy) * 40 + x + dx) * 4 + 3];
      if (alpha(0, 0) < 232) continue;
      const point = [(x + 0.5) / 40, (y + 0.5) / 40];
      if (
        alpha(-1, 0) < 175 ||
        alpha(1, 0) < 175 ||
        alpha(0, -1) < 175 ||
        alpha(0, 1) < 175
      )
        outline.push(point);
      if (y < 25) blooms.push(point);
    }
  }
  const points = [...outline, ...outline, ...blooms];
  silhouettes.set(image, points);
  return points;
}

const clamp = (value) => Math.min(1, Math.max(0, value));
const mix = (from, to, t) => from + (to - from) * t;
const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};

function createParticles(count, width, height, photo, direction, framed) {
  const padding = framed ? width * 0.05 : 0;
  const naturalWidth = photo.naturalWidth || 1;
  const naturalHeight = photo.naturalHeight || 1;
  const scale = Math.min(
    (width - padding * 2) / naturalWidth,
    (height - padding * 2) / naturalHeight,
  );
  const photoWidth = naturalWidth * scale;
  const photoHeight = naturalHeight * scale;
  const points = silhouette(photo);

  return Array.from({ length: count }, (_, i) => {
    // Launch from all four sides, then curve out before landing on the next photo.
    const angle = ((i + Math.random() * 0.8) / count) * turn;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const rim = 1 / Math.max(Math.abs(dx), Math.abs(dy));
    const depth = Math.random();
    const target = points[Math.floor(Math.random() * points.length)] || [
      0.2 + Math.random() * 0.6,
      0.12 + Math.random() * 0.64,
    ];

    return {
      x: width * (0.5 + dx * rim * (framed ? 0.37 : 0.42)),
      y: height * (0.55 + dy * rim * 0.4),
      arcX: width * (0.5 + dx * (0.38 + depth * 0.12) - dy * 0.09 * direction),
      arcY: height * (0.5 + dy * (0.37 + depth * 0.12) + dx * 0.08 * direction),
      endX: width / 2 + (target[0] - 0.5) * photoWidth,
      endY: height / 2 + (target[1] - 0.5) * photoHeight,
      size: 10 + depth * Math.min(46, width * 0.102),
      angle,
      depth,
      spin: (i % 2 ? -1 : 1) * (3 + depth * 6),
      delay: Math.random() * 0.09,
    };
  }).sort((a, b) => a.depth - b.depth);
}

function drawPetal(ctx, particle, progress, direction) {
  const p = particle;
  const t = clamp((progress - p.delay) / (0.94 - p.delay));
  const out = 1 - (1 - clamp(t / 0.42)) ** 2;
  const inwards = smooth((t - 0.42) / 0.58);
  const flutter = Math.sin(t * turn * 1.6 + p.angle) * Math.sin(t * Math.PI);
  const x = mix(mix(p.x, p.arcX, out), p.endX, inwards) + flutter * 15;
  const y = mix(mix(p.y, p.arcY, out), p.endY, inwards) + flutter * 12;
  const size = p.size * mix(0.62, 1.28, out) * mix(1, 0.39, inwards);
  const face = Math.cos(p.angle + t * p.spin);
  const rotation = p.angle + t * p.spin * 0.54 + flutter * 0.46 * direction;

  ctx.save();
  ctx.globalAlpha = smooth(t / 0.14) * (1 - smooth((t - 0.81) / 0.19));
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(0.17 + 0.83 * Math.abs(face), 0.86 + 0.14 * face);
  ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
  ctx.restore();
}

export function createPetalTransition(surface, canvas, reduced) {
  const ctx = canvas.getContext("2d");
  let frame = 0;
  let outgoing;
  let incoming;

  function clear() {
    cancelAnimationFrame(frame);
    canvas.classList.remove("active");
    surface.classList.remove("petals-changing");
    if (outgoing) {
      outgoing.remove();
      outgoing.classList.remove("outgoing");
      outgoing.removeAttribute("aria-hidden");
      outgoing.style.removeProperty("opacity");
    }
    incoming?.style.removeProperty("opacity");
    outgoing = incoming = undefined;
  }

  reduced.addEventListener("change", clear);

  function swap(next, direction, count, photo = next) {
    const previous = surface.firstElementChild;
    clear();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (
      !ctx ||
      reduced.matches ||
      !previous ||
      !direction ||
      !width ||
      !height
    ) {
      surface.replaceChildren(next);
      return;
    }

    outgoing =
      previous.tagName === "VIDEO" ? document.createElement("img") : previous;
    if (outgoing !== previous) outgoing.src = previous.poster;
    outgoing.classList.add("outgoing");
    outgoing.setAttribute("aria-hidden", "true");
    incoming = next;
    incoming.style.opacity = "0";
    surface.replaceChildren(incoming, outgoing);
    surface.classList.add("petals-changing");

    const density = Math.min(
      devicePixelRatio,
      1.35,
      Math.sqrt(620000 / (width * height)),
    );
    canvas.width = Math.max(1, Math.round(width * density));
    canvas.height = Math.max(1, Math.round(height * density));
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    const particles = createParticles(
      count,
      width,
      height,
      photo,
      direction,
      surface.classList.contains("media"),
    );
    canvas.classList.add("active");

    const start = performance.now();
    function draw(now) {
      const t = clamp((now - start) / duration);
      if (t >= 1) {
        clear();
        return;
      }
      outgoing.style.opacity = 1 - smooth((t - 0.04) / 0.31);
      incoming.style.opacity = smooth((t - 0.53) / 0.43);
      ctx.clearRect(0, 0, width, height);
      if (spriteReady) {
        for (const particle of particles)
          drawPetal(ctx, particle, t, direction);
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
  }

  return { swap, clear };
}
