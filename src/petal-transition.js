// A gust carries the petals sideways. Each petal drifts, tumbles and falls independently.
export function createPetalTransition(surface, overlay, reduced) {
  let animations = [];
  let outgoing;

  function clear() {
    for (const animation of animations) animation.cancel();
    animations = [];
    outgoing?.remove();
    outgoing = undefined;
    overlay.replaceChildren();
  }

  reduced.addEventListener("change", clear);

  function swap(next, direction, count) {
    const previous = surface.firstElementChild;
    clear();
    if (reduced.matches || !previous || !direction) {
      surface.replaceChildren(next);
      return;
    }

    const ghost = previous.cloneNode();
    ghost.classList.add("outgoing");
    ghost.setAttribute("aria-hidden", "true");
    outgoing = ghost;
    surface.replaceChildren(next, ghost);

    const wind = -direction;
    const easing = "cubic-bezier(.22,1,.36,1)";
    const outgoingMotion = ghost.animate(
      [
        { opacity: 1, translate: "0" },
        { opacity: 0, translate: `${wind * 5}% -1%` },
      ],
      { duration: 410, easing, fill: "both" },
    );
    const incomingMotion = next.animate(
      [
        { opacity: 0, translate: `${-wind * 4}% 1%` },
        { opacity: 1, translate: "0" },
      ],
      { duration: 540, delay: 95, easing, fill: "both" },
    );
    outgoingMotion.finished.then(
      () => ghost.remove(),
      () => ghost.remove(),
    );
    incomingMotion.finished.then(
      () => incomingMotion.cancel(),
      () => {},
    );
    animations.push(outgoingMotion, incomingMotion);

    const width = overlay.clientWidth;
    const height = overlay.clientHeight;
    const petals = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const depth = Math.random();
      const x = width * (0.26 + Math.random() * 0.48);
      const y = height * (0.26 + Math.random() * 0.38);
      const edge = wind > 0 ? width - x : x;
      const travel = wind * (edge + 48 + depth * width * 0.36);
      const lift = -(0.04 + Math.random() * 0.42) * height;
      const fall = (Math.random() - 0.27) * height * 0.8;
      const spin = (190 + Math.random() * 360) * (i % 2 ? 1 : -1);
      const startAngle = Math.random() * 360;
      const size = 13 + depth * Math.min(35, width * 0.075);
      const petal = document.createElement("span");
      petal.className = "flying-petal";
      petal.style.cssText = `left:${x}px;top:${y}px;width:${size}px;--petal-angle:${startAngle}deg`;
      petals.append(petal);

      const animation = petal.animate(
        [
          {
            transform:
              "translate3d(0,0,-35px) rotateY(0deg) rotateZ(var(--petal-angle))",
            opacity: 0,
          },
          {
            transform: `translate3d(${travel * 0.2}px,${lift * 0.75}px,16px) rotateY(${spin * 0.3}deg) rotateZ(${startAngle + spin * 0.12}deg)`,
            opacity: 1,
            offset: 0.25,
          },
          {
            transform: `translate3d(${travel * 0.61}px,${lift + fall * 0.18}px,${depth * 110}px) rotateY(${spin * 0.76}deg) rotateZ(${startAngle + spin * 0.38}deg)`,
            opacity: 0.98,
            offset: 0.61,
          },
          {
            transform: `translate3d(${travel}px,${lift + fall}px,${depth * 200}px) rotateY(${spin}deg) rotateZ(${startAngle + spin * 0.63}deg)`,
            opacity: 0,
          },
        ],
        { duration: 640 + Math.random() * 410, delay: i * 8, fill: "both" },
      );
      animation.finished.then(
        () => petal.remove(),
        () => petal.remove(),
      );
      animations.push(animation);
    }
    overlay.append(petals);
  }

  return { swap, clear };
}
