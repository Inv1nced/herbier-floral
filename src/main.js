import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { asset, works, contacts } from "./works.js";
import { createDisplacement } from "./displacement.js";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/inter";
import "./style.css";

gsap.registerPlugin(ScrollTrigger);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const lowPower =
  navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 4;
const richMotion = () => !reduced.matches && !lowPower;
const wrap = (index) => (index + works.length) % works.length;
const total = String(works.length).padStart(2, "0");
const thumb = (work, size) => asset(`assets/bouquets/${work.id}-${size}.webp`);

const collection = $("#collection");
const stage = $("#stage");
const media = $("#media");
const canvas = $(".transition");
const filmstrip = $(".filmstrip");
const gallery = $(".masonry");
const dialog = $(".lightbox");
const modalMedia = $(".lightbox-media");
const colors = [
  "#ebd8ce",
  "#e5dbe2",
  "#ebd6d5",
  "#e8dfcc",
  "#e0e5d2",
  "#efdec9",
  "#e5dce3",
  "#efe0cd",
];
const ratios = ["1.06", ".82", "1.1", ".85", "1.1", ".86", "1.08", ".88"];
const preload = new Map();
let current = 0;
let modalIndex = 0;
let selection = 0;
let displacement;
let playingTransition = false;
let queued;
let lenis;
let modalTrigger;

function picture(work, context) {
  const image = new Image();
  image.alt = work.subtitle;
  image.draggable = false;
  image.decoding = "async";
  if (context === "gallery") {
    image.loading = "lazy";
    image.srcset = `${thumb(work, 160)} 160w, ${thumb(work, 480)} 480w, ${thumb(work, 960)} 960w`;
    image.sizes = "(max-width: 800px) 45vw, 30vw";
    image.src = thumb(work, 480);
  } else if (context === "thumb") {
    image.loading = "lazy";
    image.alt = "";
    image.src = thumb(work, 160);
  } else {
    image.src =
      context === "stage" && !fine.matches
        ? thumb(work, 480)
        : asset(work.cutout || work.image);
  }
  return image;
}

function video(work) {
  const clip = document.createElement("video");
  clip.muted = clip.autoplay = clip.loop = clip.playsInline = true;
  clip.poster = asset(work.image);
  clip.src = asset(work.video);
  clip.setAttribute("aria-label", work.subtitle);
  clip.addEventListener(
    "error",
    () => clip.replaceWith(picture(work, "modal")),
    { once: true },
  );
  return clip;
}

function prepared(index) {
  if (!preload.has(index)) {
    const image = picture(works[index], "stage");
    preload.set(index, { image, ready: image.decode().catch(() => {}) });
  }
  return preload.get(index);
}

function appendThumbnail(work, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Букет ${work.id}. ${work.title}`);
  const label = document.createElement("span");
  label.textContent = work.id;
  label.setAttribute("aria-hidden", "true");
  button.append(picture(work, "thumb"), label);
  button.addEventListener("click", () => go(index));
  filmstrip.append(button);
  return button;
}

function appendWork(work, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "work";
  button.setAttribute("aria-haspopup", "dialog");
  button.innerHTML =
    '<span class="work-image"></span><span class="work-info"><strong></strong><small></small></span>';
  const art = $(".work-image", button);
  art.style.setProperty("--card", colors[index % colors.length]);
  art.style.setProperty("--ratio", ratios[index % ratios.length]);
  const photo = picture(work, "gallery");
  photo.alt = "";
  art.append(photo);
  $("strong", button).textContent = work.title;
  $("small", button).textContent = work.id;
  $("small", button).setAttribute("aria-hidden", "true");
  button.addEventListener("click", () => openModal(index, button));
  gallery.append(button);
  return button;
}

const tabs = works.map(appendThumbnail);
const cards = works.map(appendWork);
$(".counter span:last-child").textContent = `/ ${total}`;
$(".gallery .section-top>span").textContent = `Работы · ${total}`;

function palette(image, index) {
  if (!image.naturalWidth) return colors[index % colors.length];
  const sample = document.createElement("canvas");
  sample.width = sample.height = 16;
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  if (!ctx) return colors[index % colors.length];
  ctx.drawImage(image, 0, 0, 16, 16);
  const { data } = ctx.getImageData(0, 0, 16, 16);
  let weight = 0;
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    const pixel = [data[i], data[i + 1], data[i + 2]];
    const saturation = Math.max(...pixel) - Math.min(...pixel);
    const alpha = (data[i + 3] / 255) * (0.25 + saturation / 128);
    pixel.forEach((value, channel) => {
      sum[channel] += value * alpha;
    });
    weight += alpha;
  }
  if (!weight) return colors[index % colors.length];
  const base = [251, 241, 231];
  return `rgb(${sum.map((value, channel) => Math.round(base[channel] * 0.67 + (0.33 * value) / weight)).join(",")})`;
}

function slideText(index, animate, direction) {
  const work = works[index];
  const number = $("#slide-number");
  const title = $("#slide-title");
  const subtitle = $("#slide-subtitle");
  number.textContent = work.id;
  title.textContent = work.title;
  subtitle.textContent = work.subtitle;
  tabs.forEach((button, i) =>
    button.setAttribute("aria-current", String(i === index)),
  );
  const active = tabs[index];
  if (filmstrip.scrollWidth > filmstrip.clientWidth) {
    const x =
      active.getBoundingClientRect().left -
      filmstrip.getBoundingClientRect().left;
    filmstrip.scrollTo({
      left:
        filmstrip.scrollLeft +
        x -
        (filmstrip.clientWidth - active.offsetWidth) / 2,
      behavior: reduced.matches ? "instant" : "smooth",
    });
  }
  if (!animate) return;
  gsap.fromTo(
    number,
    { yPercent: direction * 100 },
    { yPercent: 0, duration: 0.52, ease: "power3.out", overwrite: true },
  );
  gsap.fromTo(
    title,
    { yPercent: 105 },
    { yPercent: 0, duration: 0.78, ease: "power4.out", overwrite: true },
  );
  gsap.fromTo(
    subtitle,
    { opacity: 0 },
    { opacity: 1, duration: 0.6, overwrite: true },
  );
}

function burst(direction) {
  if (!richMotion()) return;
  const container = $(".stage-petals");
  for (let i = 0; i < 5; i++) {
    const petal = document.createElement("i");
    petal.className = "petal";
    petal.style.cssText = `--size:${7 + i * 2}px;top:${32 + i * 7}%;left:${44 + i * 3}%;animation:none`;
    container.append(petal);
    petal
      .animate(
        [
          { transform: "scale(.8)", opacity: 0 },
          { opacity: 0.8, offset: 0.25 },
          {
            transform: `translate(${direction * (55 + 22 * i)}px,${-50 + 35 * i}px) rotate3d(1,1,1,270deg)`,
            opacity: 0,
          },
        ],
        { duration: 900 + i * 100, easing: "ease-out" },
      )
      .finished.then(() => petal.remove());
  }
}

async function go(index, direction = Math.sign(index - current) || 1) {
  index = wrap(index);
  if (playingTransition) {
    queued = { index, direction };
    return;
  }
  const request = ++selection;
  if (current === index) return;
  const before = prepared(current);
  const after = prepared(index);
  await after.ready;
  if (request !== selection) return;
  const work = works[index];
  const next = work.video && !reduced.matches ? video(work) : after.image;
  const motion = !reduced.matches;
  let effect;
  if (
    motion &&
    richMotion() &&
    fine.matches &&
    !work.video &&
    !works[current].video
  ) {
    if (displacement === undefined) {
      try {
        displacement = createDisplacement(canvas);
      } catch {
        displacement = null;
      }
    }
    try {
      effect = displacement?.(before.image, after.image, direction);
    } catch {
      displacement = null;
    }
  }
  playingTransition = Boolean(effect);
  current = index;
  collection.style.setProperty("--slide-color", palette(after.image, index));
  slideText(index, motion, direction);
  burst(direction);
  if (effect) {
    media.style.visibility = "hidden";
    await effect;
    media.style.visibility = "";
  }
  media.replaceChildren(next);
  if (!effect && motion) {
    gsap.fromTo(
      media,
      {
        clipPath: direction > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)",
        scale: 0.96,
      },
      {
        clipPath: "inset(0 0 0 0)",
        scale: 1,
        duration: 0.8,
        ease: "power4.out",
        clearProps: "clipPath,scale",
        overwrite: "auto",
      },
    );
  }
  playingTransition = false;
  prepared(wrap(index + 1));
  prepared(wrap(index - 1));
  if (queued) {
    const target = queued;
    queued = undefined;
    go(target.index, target.direction);
  }
}

const first = prepared(0);
media.append(
  works[0].video && !reduced.matches ? video(works[0]) : first.image,
);
slideText(0, false, 1);
first.ready.then(() => {
  if (current === 0)
    collection.style.setProperty("--slide-color", palette(first.image, 0));
});
const nearCollection = new IntersectionObserver(
  ([entry], observer) => {
    if (!entry.isIntersecting) return;
    prepared(1);
    prepared(works.length - 1);
    observer.disconnect();
  },
  { rootMargin: "240px" },
);
nearCollection.observe(collection);

function bindSwipe(surface, shift, onMove, onEnd) {
  let drag;
  surface.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: performance.now(),
    };
    surface.setPointerCapture(event.pointerId);
    surface.classList.add("dragging");
  });
  surface.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) return;
    onMove?.(event.clientX - drag.x);
  });
  function end(event) {
    if (drag?.id !== event.pointerId) return;
    const x = event.clientX - drag.x;
    const y = event.clientY - drag.y;
    const quick = performance.now() - drag.start < 300;
    drag = undefined;
    surface.classList.remove("dragging");
    onEnd?.();
    if (
      event.type === "pointerup" &&
      Math.abs(x) > Math.max(quick ? 32 : 60, Math.abs(y) * 1.25)
    )
      shift(x > 0 ? -1 : 1);
  }
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    surface.addEventListener(name, end);
}

function setTilt(x = 0, y = 0, shift = 0) {
  media.style.transform = `translateX(${shift}px) rotateX(${y}deg) rotateY(${x}deg)`;
}

const shiftSlide = (step) => go(current + step, step);
bindSwipe(
  stage,
  shiftSlide,
  (x) => {
    if (!reduced.matches)
      setTilt(x / 26, 0, Math.sign(x) * Math.sqrt(Math.abs(x)) * 3.2);
  },
  () => setTilt(),
);
stage.addEventListener("pointermove", (event) => {
  if (!fine.matches || reduced.matches || stage.classList.contains("dragging"))
    return;
  const bounds = stage.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  setTilt((x - 0.5) * 13, (0.5 - y) * 10);
  stage.style.setProperty("--gx", `${x * 100}%`);
  stage.style.setProperty("--gy", `${y * 100}%`);
});
stage.addEventListener("pointerleave", () => {
  if (!stage.classList.contains("dragging")) setTilt();
});

if (
  !fine.matches &&
  "DeviceOrientationEvent" in window &&
  !DeviceOrientationEvent.requestPermission
) {
  let restingTilt;
  window.addEventListener(
    "deviceorientation",
    (event) => {
      if (
        !richMotion() ||
        event.gamma == null ||
        event.beta == null ||
        stage.classList.contains("dragging")
      )
        return;
      const bounds = stage.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > innerHeight) {
        restingTilt = undefined;
        return;
      }
      restingTilt ??= { gamma: event.gamma, beta: event.beta };
      const limit = (value) => gsap.utils.clamp(-8, 8, value);
      setTilt(
        limit((event.gamma - restingTilt.gamma) * 0.55),
        limit((restingTilt.beta - event.beta) * 0.4),
      );
    },
    { passive: true },
  );
}

let lastWheel = -Infinity;
let wheelAmount = 0;
let lastWheelEvent = -Infinity;
stage.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) return;
    const now = performance.now();
    const amount =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    const step = Math.sign(amount);
    if (!step || current + step < 0 || current + step >= works.length) return;
    event.preventDefault();
    if (now - lastWheelEvent > 160) wheelAmount = 0;
    lastWheelEvent = now;
    wheelAmount += amount * (event.deltaMode === 1 ? 16 : 1);
    if (now - lastWheel < 700 || Math.abs(wheelAmount) < 28) return;
    lastWheel = now;
    wheelAmount = 0;
    shiftSlide(step);
  },
  { passive: false },
);

$$("[data-shift]").forEach((button) =>
  button.addEventListener("click", () =>
    shiftSlide(Number(button.dataset.shift)),
  ),
);
function arrowKeys(event, shift) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  shift(event.key === "ArrowLeft" ? -1 : 1);
}
collection.addEventListener("keydown", (event) => arrowKeys(event, shiftSlide));

function renderModal(index) {
  modalIndex = wrap(index);
  const work = works[modalIndex];
  modalMedia.replaceChildren(
    work.video && !reduced.matches ? video(work) : picture(work, "modal"),
  );
  $(".lightbox-counter").textContent = `${work.id} / ${total}`;
  $("#lightbox-title").textContent = work.title;
  $(".lightbox-caption p").textContent = work.subtitle;
  if (!reduced.matches) {
    gsap.fromTo(
      modalMedia,
      { opacity: 0.15, scale: 0.97 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.38,
        ease: "power3.out",
        overwrite: true,
      },
    );
  }
}
function openModal(index, trigger) {
  modalTrigger = trigger;
  renderModal(index);
  dialog.showModal();
  lenis?.stop();
}
const shiftModal = (step) => renderModal(modalIndex + step);
bindSwipe(modalMedia, shiftModal);
$$("[data-modal-shift]").forEach((button) =>
  button.addEventListener("click", () =>
    shiftModal(Number(button.dataset.modalShift)),
  ),
);
dialog.addEventListener("keydown", (event) => arrowKeys(event, shiftModal));
$("[data-close]").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  modalMedia.replaceChildren();
  lenis?.start();
  modalTrigger?.focus({ preventScroll: true });
});

function configureContacts() {
  const icons = {
    Instagram:
      '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    TikTok: '<path d="M14 3v12a4 4 0 1 1-4-4m4-8c.6 3.5 2.4 5.2 6 6"/>',
    Почта:
      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  };
  const links = [
    ["Instagram", contacts.instagram],
    ["TikTok", contacts.tiktok],
    ["Почта", contacts.email ? `mailto:${contacts.email}` : ""],
  ].filter(([, href]) => href);
  const dock = $(".social-dock");
  $(".contact-empty").hidden = links.length > 0;
  dock.hidden = !links.length;
  for (const container of [$(".socials"), dock]) {
    for (const [label, href] of links) {
      const link = document.createElement("a");
      link.className = "round";
      link.href = href;
      link.setAttribute("aria-label", label);
      link.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[label]}</svg>`;
      if (fine.matches) {
        link.addEventListener("pointermove", (event) => {
          if (reduced.matches) return;
          const rect = link.getBoundingClientRect();
          const x = (event.clientX - rect.left - rect.width / 2) * 0.24;
          const y = (event.clientY - rect.top - rect.height / 2) * 0.24;
          gsap.to(link, {
            x,
            y,
            rotation: 10,
            duration: 0.35,
            overwrite: true,
          });
        });
        link.addEventListener("pointerleave", () =>
          gsap.to(link, {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 0.4,
            overwrite: true,
          }),
        );
      }
      container.append(link);
    }
  }
}
configureContacts();

function setupScroll() {
  lenis?.destroy();
  lenis = undefined;
  if (richMotion() && fine.matches) {
    lenis = new Lenis({
      autoRaf: true,
      anchors: { offset: 0 },
      stopInertiaOnNavigate: true,
      prevent: (node) => node.closest?.(".stage, .filmstrip, .lightbox"),
    });
    lenis.on("scroll", ScrollTrigger.update);
    if (dialog.open) lenis.stop();
  }
}
reduced.addEventListener("change", setupScroll);
setupScroll();

function textParts(element, letters) {
  const content = element.textContent;
  const tokens = letters ? [...content] : content.split(/(\s+)/);
  if (letters) element.setAttribute("aria-label", content);
  element.replaceChildren(
    ...tokens.map((part) => {
      if (!part.trim()) return document.createTextNode(part);
      const span = document.createElement("span");
      span.className = letters ? "letter" : "word";
      if (letters) span.setAttribute("aria-hidden", "true");
      span.textContent = part;
      return span;
    }),
  );
  return [...element.children];
}

function heroPetals() {
  const holder = $(".petals");
  for (let i = 0; i < 16; i++) {
    const petal = document.createElement("i");
    petal.className = "petal";
    petal.style.cssText = `left:${(i * 37) % 101}%;--size:${5 + ((i * 7) % 13)}px;--duration:${13 + ((i * 5) % 14)}s;--delay:-${(i * 41) % 24}s;--drift:${i % 2 ? -115 : 155}px`;
    holder.append(petal);
  }
  $(".hero").addEventListener("pointermove", (event) => {
    if (!fine.matches || !richMotion()) return;
    gsap.to(holder, {
      x: (event.clientX / innerWidth - 0.5) * 90,
      duration: 1.4,
      ease: "power2.out",
      overwrite: true,
    });
  });
  const observer = new IntersectionObserver(([entry]) => {
    $$(".petal", holder).forEach((petal) => {
      petal.style.animationPlayState = entry.isIntersecting
        ? "running"
        : "paused";
    });
  });
  observer.observe(holder);
}

function entrance() {
  const loader = $(".loader");
  const letters = textParts($("#hero-title"), true);
  let seen = false;
  try {
    seen = sessionStorage.getItem("herbier-intro") === "1";
    sessionStorage.setItem("herbier-intro", "1");
  } catch {
    /* Storage may be disabled. */
  }
  if (seen) {
    gsap.from(letters, {
      y: 25,
      opacity: 0,
      stagger: 0.045,
      duration: 0.65,
      ease: "power3.out",
    });
    return;
  }
  loader.hidden = false;
  const path = $("path", loader);
  const length = path.getTotalLength();
  const percent = { value: 0 };
  const tl = gsap.timeline({
    onComplete: () => {
      loader.hidden = true;
    },
  });
  tl.fromTo(
    path,
    { strokeDasharray: length, strokeDashoffset: length },
    { strokeDashoffset: 0, duration: 1.28, ease: "power2.inOut" },
    0,
  );
  tl.to(
    percent,
    {
      value: 100,
      duration: 1.28,
      onUpdate: () => {
        $("span", loader).textContent = `${Math.round(percent.value)}%`;
      },
    },
    0,
  );
  tl.to(loader, { yPercent: -100, duration: 0.83, ease: "expo.inOut" }, 1.28);
  tl.from(
    letters,
    {
      y: 48,
      opacity: 0,
      filter: "blur(7px)",
      stagger: 0.043,
      duration: 0.85,
      ease: "power4.out",
    },
    1.57,
  );
}

if (richMotion()) {
  heroPetals();
  entrance();
  ScrollTrigger.batch(cards, {
    start: "top 95%",
    once: true,
    onEnter: (batch) =>
      gsap.from(batch, {
        opacity: 0.05,
        y: 28,
        stagger: 0.08,
        duration: 0.65,
        ease: "power3.out",
      }),
  });
  ScrollTrigger.create({
    trigger: ".about-text",
    start: "top 91%",
    once: true,
    onEnter: () => {
      gsap.from(textParts($(".about-text"), false), {
        opacity: 0.86,
        stagger: 0.025,
        duration: 0.38,
      });
    },
  });
  gsap.from(".contact h2", {
    y: 24,
    opacity: 0.8,
    duration: 0.9,
    ease: "power3.out",
    scrollTrigger: { trigger: ".contact h2", start: "top 90%", once: true },
  });
  if (fine.matches) {
    const cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.textContent = "Смотреть";
    cursor.hidden = true;
    cursor.setAttribute("aria-hidden", "true");
    document.body.append(cursor);
    const x = gsap.quickTo(cursor, "x", { duration: 0.2, ease: "power3.out" });
    const y = gsap.quickTo(cursor, "y", { duration: 0.2, ease: "power3.out" });
    for (const card of cards) {
      const art = $(".work-image", card);
      art.addEventListener("pointerenter", (event) => {
        if (reduced.matches || event.pointerType !== "mouse") return;
        gsap.set(cursor, { x: event.clientX - 36, y: event.clientY - 36 });
        cursor.hidden = false;
      });
      art.addEventListener("pointermove", (event) => {
        x(event.clientX - 36);
        y(event.clientY - 36);
      });
      art.addEventListener("pointerleave", () => {
        cursor.hidden = true;
      });
      card.addEventListener("click", () => {
        cursor.hidden = true;
      });
    }
  }
}
