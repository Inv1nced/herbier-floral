import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { asset, works, contacts } from "./works.js";
import { createPetalTransition } from "./petal-transition.js";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";
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
const filmstrip = $(".filmstrip");
const gallery = $(".masonry");
const dialog = $(".lightbox");
const modalMedia = $(".lightbox-media");
const modalPicture = $(".lightbox-picture");
const slideEffect = createPetalTransition(media, $(".stage-petals"), reduced);
const modalEffect = createPetalTransition(
  modalPicture,
  $(".lightbox-petals"),
  reduced,
);
const ratios = ["1.06", ".82", "1.1", ".85", "1.1", ".86", "1.08", ".88"];
const preload = new Map();
let current = 0;
let modalIndex = 0;
let selection = 0;
let lenis;
let modalTrigger;

function picture(work, context) {
  const image = new Image();
  image.alt = work.description;
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
  clip.setAttribute("aria-label", work.description);
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
  button.setAttribute("aria-label", `Букет ${work.id}`);
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
    '<span class="work-image"></span><span class="work-info"></span>';
  const art = $(".work-image", button);
  art.style.setProperty("--ratio", ratios[index % ratios.length]);
  const photo = picture(work, "gallery");
  photo.alt = "";
  art.append(photo);
  $(".work-info", button).textContent = work.id;
  button.setAttribute(
    "aria-label",
    `Открыть букет ${work.id}. ${work.description}`,
  );
  button.addEventListener("click", () => openModal(index, button));
  gallery.append(button);
  return button;
}

const tabs = works.map(appendThumbnail);
const cards = works.map(appendWork);
$(".counter span:last-child").textContent = `/ ${total}`;
$(".gallery .section-top>span").textContent = `Работы · ${total}`;

function slideText(index, animate, direction) {
  const work = works[index];
  const number = $("#slide-number");
  number.textContent = work.id;
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
}

function petalCount() {
  if (lowPower) return 10;
  return fine.matches ? 23 : 15;
}

async function go(index, direction = Math.sign(index - current) || 1) {
  index = wrap(index);
  const request = ++selection;
  if (current === index) return;
  const after = prepared(index);
  await after.ready;
  if (request !== selection) return;
  const work = works[index];
  const next = work.video && !reduced.matches ? video(work) : after.image;
  current = index;
  slideEffect.swap(next, direction, petalCount());
  slideText(index, !reduced.matches, direction);
  prepared(wrap(index + 1));
  prepared(wrap(index - 1));
}

const first = prepared(0);
media.append(
  works[0].video && !reduced.matches ? video(works[0]) : first.image,
);
slideText(0, false, 1);
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

function renderModal(index, direction = 0) {
  modalIndex = wrap(index);
  const work = works[modalIndex];
  const next =
    work.video && !reduced.matches ? video(work) : picture(work, "modal");
  modalEffect.swap(next, direction, petalCount());
  $(".lightbox-counter").textContent = `Букет ${work.id} / ${total}`;
}
function openModal(index, trigger) {
  modalTrigger = trigger;
  renderModal(index);
  dialog.showModal();
  lenis?.stop();
}
const shiftModal = (step) => renderModal(modalIndex + step, step);
bindSwipe(modalMedia, shiftModal);
$$("[data-modal-shift]").forEach((button) =>
  button.addEventListener("click", () =>
    shiftModal(Number(button.dataset.modalShift)),
  ),
);
dialog.addEventListener("keydown", (event) => arrowKeys(event, shiftModal));
$("[data-close]").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  modalEffect.clear();
  modalPicture.replaceChildren();
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
    ["TikTok", contacts.tiktok],
    ["Instagram", contacts.instagram],
    ["Почта", contacts.email ? `mailto:${contacts.email}` : ""],
  ];
  const activeLinks = links.filter(([, href]) => href);
  const dock = $(".social-dock");
  $(".contact-empty").hidden = activeLinks.length === links.length;
  dock.hidden = activeLinks.length === 0;
  for (const container of [$(".socials"), dock]) {
    for (const [label, href] of container === dock ? activeLinks : links) {
      const link = document.createElement(href ? "a" : "span");
      link.className = container === dock ? "round" : "contact-item";
      if (href) link.href = href;
      if (container === dock) link.setAttribute("aria-label", label);
      const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[label]}</svg>`;
      link.innerHTML =
        container === dock
          ? icon
          : `<span class="round">${icon}</span><span>${label}</span>`;
      if (href && fine.matches) {
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
  const lines = $$(".name-line");
  let seen = false;
  try {
    seen = sessionStorage.getItem("herbier-intro") === "1";
    sessionStorage.setItem("herbier-intro", "1");
  } catch {
    /* Storage may be disabled. */
  }
  if (seen) {
    gsap.from(lines, {
      y: 25,
      opacity: 0,
      stagger: 0.09,
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
    lines,
    {
      y: 48,
      opacity: 0,
      filter: "blur(7px)",
      stagger: 0.09,
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
