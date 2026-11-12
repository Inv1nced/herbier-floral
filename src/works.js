const entries = [
  "Белые и розовые цветы в пудровой бумаге",
  "Светлая композиция с сиреневыми акцентами",
  "Розы с малиновой лентой в цветочной сумочке",
  "Бордовые и сливочные оттенки с оливковой лентой",
  "Герберы и яркие цветовые акценты в зелёной бумаге",
  "Кремовые розы, красные цветы и голубая гортензия",
  "Пастельные цветы в светло-розовой сумочке",
  "Тёплая композиция с красным бантом",
];

export const asset = (name) => `${import.meta.env.BASE_URL}${name}`;

export const works = entries.map((description, index) => {
  const id = String(index + 1).padStart(2, "0");
  const cutout = `assets/bouquets/${id}-960.webp`;
  return { id, description, image: cutout, cutout };
});

export const contacts = {
  instagram: "",
  tiktok: "",
  email: "",
};
