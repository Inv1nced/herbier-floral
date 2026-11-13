export function createPhotoTransition(surface, reduced) {
  let animation;
  let outgoing;

  function clear() {
    animation?.cancel();
    outgoing?.remove();
    animation = outgoing = undefined;
  }

  reduced.addEventListener("change", clear);

  function swap(next, direction) {
    clear();
    const previous = surface.firstElementChild;
    if (!previous || !direction || reduced.matches) {
      surface.replaceChildren(next);
      return;
    }

    outgoing =
      previous.tagName === "VIDEO"
        ? document.createElement("img")
        : previous.cloneNode();
    if (previous.tagName === "VIDEO") outgoing.src = previous.poster;
    outgoing.classList.add("outgoing");
    outgoing.setAttribute("aria-hidden", "true");
    surface.replaceChildren(next, outgoing);
    const easing = "cubic-bezier(.22,.61,.36,1)";
    outgoing.animate(
      [
        { opacity: 1, translate: "0" },
        { opacity: 0, translate: `${-direction * 2}% 0` },
      ],
      { duration: 420, easing, fill: "forwards" },
    );
    const current = next.animate(
      [
        { opacity: 0, translate: `${direction * 2}% 0` },
        { opacity: 1, translate: "0" },
      ],
      { duration: 460, easing },
    );
    animation = current;
    current.finished.then(
      () => {
        if (animation === current) clear();
      },
      () => {},
    );
  }

  return { swap, clear };
}
