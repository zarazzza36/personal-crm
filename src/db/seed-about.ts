// "Кто это" for test contacts: the people a logistician deals with.
// Shared by the seed and by one-off scripts that refill existing test data.

import type { BodyType } from "../lib/body-types";

export type Gender = "male" | "female";
type Gendered = string | { male: string; female: string };

type Truck = {
  capacityTons: number | null;
  volumeCubicMeters: number | null;
  bodyType: BodyType | null;
};

// Truck owners and drivers, by the kind of truck: the description matches the truck fields.
const truckKinds = {
  gazelle: [
    "ГАЗ, встретились под Омском",
    "Газель, возит по городу и области",
    "Водитель Газели, берёт догрузы",
    "Газель, работает на переездах",
    "Газель-фургон, развозит по магазинам",
  ],
  medium: [
    "Пятитонник, ходит по области",
    "ISUZU, встретились на заправке под Тюменью",
    "Десятитонник, работает по Уралу",
    "Свой Камаз, без посредников",
    "Бычок, возит стройматериалы",
  ],
  heavy: [
    { male: "Дальнобойщик, встретились на трассе М-5", female: "Дальнобойщица, встретились на трассе М-5" },
    "Фура, Вольво, ходит Москва — Питер",
    "Свой тягач, ищет обратку",
    "Сцепка, возит по всей России",
    "Скания, работает с сетевыми складами",
  ],
  jumbo: [
    "Джамбо, возит мебель",
    "Джамбо, берёт объёмные лёгкие грузы",
    "Джамбо, ходит в Казахстан",
  ],
  refrigerator: [
    "Рефка, возит заморозку",
    "Реф, работает с молочкой",
    "Реф, возит фрукты с юга",
  ],
  isothermal: [
    "Изотерм, возит продукты по сетям",
    "Изотерм, работает с хлебозаводом",
  ],
  container: [
    "Контейнеровоз, работает с портом Новороссийска",
    "Возит контейнеры со станции",
    "Контейнеровоз, ходит Владивосток — Хабаровск",
  ],
  dumpTruck: [
    "Самосвал, щебень и песок",
    "Самосвал, работает на стройках",
    "Самосвал, вывозит грунт",
  ],
  lowboy: [
    "Трал, возит спецтехнику",
    "Трал, перевозит экскаваторы",
    "Трал, негабарит с сопровождением",
  ],
} satisfies Record<string, Gendered[]>;

// What a logistician notes about any driver, whatever the truck.
const driverTraits: Gendered[] = [
  { male: "Кинул на груз", female: "Кинула на груз" },
  { male: "Сорвал погрузку, проверять", female: "Сорвала погрузку, проверять" },
  "Надёжный водитель, ни одного сорванного рейса",
  "Возит без предоплаты",
  "Работает только по безналу с НДС",
  "Опаздывает, но довозит",
];

// People around the trucks: services, warehouses, shippers.
const others: Gendered[] = [
  { male: "Шиномонтажник", female: "Держит шиномонтаж на трассе М-4" },
  { male: "Кинул на груз", female: "Кинула на груз" },
  { male: "Должен за рейс, обещал вернуть", female: "Должна за рейс, обещала вернуть" },
  "Диспетчер транспортной компании",
  "Экспедитор, ищет машины под свои грузы",
  "Грузоотправитель, стройматериалы",
  "Начальник склада в Подольске",
  { male: "Кладовщик, помогает с погрузкой", female: "Кладовщица, помогает с погрузкой" },
  "Механик, чинит фуры",
  "Автоэлектрик, приезжает на трассу",
  { male: "Хозяин стоянки на трассе М-7", female: "Хозяйка стоянки на трассе М-7" },
  "Брокер, перепродаёт грузы с наценкой",
  "Таможенный брокер",
  "Продаёт запчасти к Камазам",
  "Мойка грузовиков в Набережных Челнах",
  "Ставит и настраивает тахографы",
  { male: "Весовщик на элеваторе под Ростовом", female: "Весовщица на элеваторе под Ростовом" },
  "Менеджер по закупкам, заказывает перевозки",
  "Перевозчик, своя автобаза на 10 машин",
  "Логист, делимся грузами",
  "Бригадир грузчиков",
  "Страхует грузы",
  "Бухгалтер транспортной компании",
  "Оформляет пропуска в Москву для грузовиков",
  "Кафе для дальнобойщиков под Пензой",
  "Сдаёт в аренду полуприцепы",
  "Эвакуатор, вытаскивал фуру из кювета",
  "Продаёт топливо по картам",
];

const TRAIT_SHARE = 0.3;

function truckKind(truck: Truck): keyof typeof truckKinds | null {
  switch (truck.bodyType) {
    case "lowboy":
      return "lowboy";
    case "dump_truck":
      return "dumpTruck";
    case "container_carrier":
      return "container";
    case "refrigerator":
      return "refrigerator";
    case "isothermal":
      return "isothermal";
  }
  if (truck.capacityTons === null) return null;
  if ((truck.volumeCubicMeters ?? 0) >= 100) return "jumbo";
  if (truck.capacityTons <= 3) return "gazelle";
  if (truck.capacityTons <= 12) return "medium";
  return "heavy";
}

function pickByRoll<T>(items: readonly T[], roll: number) {
  return items[Math.min(Math.floor(roll * items.length), items.length - 1)];
}

/**
 * Picks a description for a contact. Draws exactly one number from `next`,
 * so the rest of the seed stays the same whatever lists are here.
 */
export function generateAbout(gender: Gender, truck: Truck, next: () => number) {
  const roll = next();
  const kind = truckKind(truck);

  let value: Gendered;
  if (kind === null) {
    value = pickByRoll(others, roll);
  } else if (roll < TRAIT_SHARE) {
    value = pickByRoll(driverTraits, roll / TRAIT_SHARE);
  } else {
    value = pickByRoll(truckKinds[kind], (roll - TRAIT_SHARE) / (1 - TRAIT_SHARE));
  }
  return typeof value === "string" ? value : value[gender];
}
