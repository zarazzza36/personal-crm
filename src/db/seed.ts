// Fills an empty database with fictional test contacts: pnpm db:seed
// Phones use the non-existent +7 000 prefix and emails use reserved example domains,
// so no test contact points to a real person.

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { BodyType } from "../lib/body-types";
import { contacts, notes } from "./schema";
import { generateAbout, type Gender } from "./seed-about";

config({ quiet: true });

const CONTACT_COUNT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const maleFirstNames = [
  "Александр", "Алексей", "Андрей", "Антон", "Артём", "Борис", "Вадим", "Валерий", "Василий",
  "Виктор", "Виталий", "Владимир", "Владислав", "Вячеслав", "Георгий", "Глеб", "Григорий",
  "Даниил", "Денис", "Дмитрий", "Евгений", "Егор", "Иван", "Игорь", "Илья", "Кирилл",
  "Константин", "Лев", "Леонид", "Максим", "Марк", "Матвей", "Михаил", "Никита", "Николай",
  "Олег", "Павел", "Пётр", "Роман", "Руслан", "Семён", "Сергей", "Станислав", "Степан",
  "Тимофей", "Тимур", "Фёдор", "Эдуард", "Юрий", "Ярослав",
];

const femaleFirstNames = [
  "Александра", "Алина", "Алиса", "Алла", "Анастасия", "Анна", "Валентина", "Валерия", "Вера",
  "Вероника", "Виктория", "Галина", "Дарья", "Диана", "Ева", "Евгения", "Екатерина", "Елена",
  "Елизавета", "Жанна", "Зоя", "Инна", "Ирина", "Карина", "Кира", "Ксения", "Лариса", "Лидия",
  "Любовь", "Людмила", "Маргарита", "Марина", "Мария", "Надежда", "Наталья", "Нина", "Оксана",
  "Олеся", "Ольга", "Полина", "Раиса", "Светлана", "София", "Таисия", "Тамара", "Татьяна",
  "Ульяна", "Юлия", "Яна", "Ярослава",
];

// Masculine forms; see `feminineSurname`.
const surnames = [
  "Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов",
  "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев", "Лебедев", "Семёнов", "Егоров",
  "Павлов", "Козлов", "Степанов", "Николаев", "Орлов", "Андреев", "Макаров", "Никитин",
  "Захаров", "Зайцев", "Соловьёв", "Борисов", "Яковлев", "Григорьев", "Романов", "Воробьёв",
  "Сергеев", "Кузьмин", "Фролов", "Александров", "Дмитриев", "Королёв", "Гусев", "Киселёв",
  "Ильин", "Максимов", "Поляков", "Сорокин", "Виноградов", "Ковалёв", "Белов", "Медведев",
  "Антонов", "Тарасов", "Жуков", "Баранов", "Филиппов", "Комаров", "Давыдов", "Беляев",
  "Герасимов", "Богданов", "Осипов", "Сидоров", "Матвеев", "Титов", "Марков", "Миронов",
  "Крылов", "Куликов", "Карпов", "Власов", "Мельников", "Денисов", "Гаврилов", "Тихонов",
  "Казаков", "Афанасьев", "Данилов", "Савельев", "Тимофеев", "Фомин", "Чернов", "Абрамов",
  "Мартынов", "Ефимов", "Федотов", "Щербаков", "Назаров", "Калинин", "Исаев", "Чернышёв",
  "Быков", "Маслов", "Родионов", "Коновалов", "Лазарев", "Воронин", "Климов", "Филатов",
  "Пономарёв", "Голубев", "Кудрявцев", "Прохоров", "Наумов", "Потапов", "Журавлёв",
  "Овчинников", "Трофимов", "Леонов", "Соболев", "Ермаков", "Колесников", "Гончаров",
  "Емельянов", "Никифоров", "Грачёв", "Котов", "Гришин", "Ефремов", "Архипов", "Громов",
  "Кириллов", "Малышев", "Панов", "Моисеев", "Румянцев", "Акимов", "Кондратьев", "Бирюков",
  "Горбунов", "Анисимов", "Ерёмин", "Тихомиров", "Галкин", "Лукьянов", "Михеев", "Скворцов",
  "Юдин", "Белоусов", "Нестеров", "Симонов", "Прокофьев", "Харитонов", "Князев", "Цветков",
  "Левин", "Митрофанов", "Воронов", "Аксёнов", "Мальцев", "Логинов", "Горшков", "Савин",
  "Краснов", "Майоров", "Демидов", "Елисеев", "Рыбаков", "Сафонов", "Плотников", "Дёмин",
  "Хохлов", "Фадеев", "Молчанов", "Игнатов", "Литвинов", "Ершов", "Ушаков", "Дементьев",
  "Рябов", "Мухин", "Калашников", "Леонтьев", "Лобанов", "Кузин", "Корнеев", "Евдокимов",
  "Бородин", "Платонов", "Некрасов", "Балашов", "Бобров", "Жданов", "Блинов", "Игнатьев",
  "Коротков", "Муравьёв", "Крюков", "Беляков", "Богомолов", "Дроздов", "Лавров", "Зуев",
  "Петухов", "Ларин", "Никулин", "Серов", "Терентьев", "Зотов", "Устинов", "Фокин",
  "Самойлов", "Константинов", "Сахаров", "Шишкин", "Самсонов", "Черкасов", "Чистяков",
  "Носов", "Спиридонов", "Карасёв", "Авдеев", "Воронцов", "Зверев", "Владимиров", "Селезнёв",
  "Нечаев", "Кудряшов", "Седов", "Фирсов", "Андрианов",
  "Островский", "Вишневский", "Раевский", "Яворский", "Ковалевский", "Левицкий", "Высоцкий",
  "Жуковский", "Белинский", "Заболоцкий",
  "Шевченко", "Бондаренко", "Ткаченко", "Кравченко", "Коваленко", "Савченко", "Руденко",
  "Мельник", "Ким", "Цой",
];

const howWeMet = [
  "Учились вместе в университете",
  "Учились в одной школе",
  "Работали вместе в одном отделе",
  "Познакомились на конференции в Казани",
  "Познакомились на дне рождения у друзей",
  "Через общих друзей",
  "Ходим в один спортзал",
  "Соседи по дому",
  "Соседи по даче",
  "Вместе ходили в поход на Алтай",
  "Познакомились в поезде Москва — Сочи",
  "На курсах английского",
  "На курсах вождения",
  "В родительском чате школы",
  "На свадьбе у родственников",
  "Вместе занимались в театральной студии",
  "Познакомились в отпуске в Калининграде",
  "Играем вместе в волейбол по выходным",
  "По рекомендации знакомых",
  "По работе: был общий проект",
  "На выставке в Москве",
  "В книжном клубе",
  "На мастер-классе по керамике",
  "Вместе волонтёрили в приюте для животных",
  "Через бывших коллег",
  "В беговом клубе",
  "На хакатоне",
  "В самолёте, сидели рядом",
  "Давние друзья семьи",
  "На встрече выпускников",
  "В коворкинге",
  "На курсах программирования",
  "На отраслевом форуме в Екатеринбурге",
  "В языковом клубе",
  "На концерте, стояли рядом в очереди",
];

const noteBodies = [
  "Договорились созвониться в начале следующего месяца.",
  "Договорились встретиться на кофе, когда будем в одном городе.",
  "Нужно вернуть книгу при следующей встрече.",
  "Жду контакты подрядчика по ремонту.",
  "Обсудили совместный проект, жду смету до пятницы.",
  "День рождения в мае. Любит настольные игры.",
  "Переезд в Санкт-Петербург осенью, просит помочь с поиском квартиры.",
  "Договорились вместе поехать на конференцию.",
  "С меня — посоветовать хорошего стоматолога.",
  "Надо поздравить с повышением.",
  "Обсуждали отпуск: советует ехать на Байкал в июле.",
  "Договорились об оплате: половина сейчас, половина по готовности.",
  "Просит познакомить с кем-нибудь из юристов.",
  "Созвонились, всё в силе. Встреча в четверг в 18:00.",
  "Не пьёт кофе, лучше звать на чай.",
  "Отдать долг — 3000 рублей до конца месяца.",
  "С меня — прислать фотографии с праздника.",
  "Говорили про смену работы: ищет вакансии в аналитике.",
  "Договорились сходить в поход в августе, нужно обсудить маршрут.",
  "Ребёнок пошёл в первый класс — спросить, как дела.",
  "Предпочитает переписку в мессенджере, на звонки отвечает редко.",
  "Нужно переслать договор на почту.",
  "Аллергия на орехи — помнить при выборе подарка.",
  "Пригласить на новоселье.",
  "Обсудили ремонт: рекомендует бригаду, пришлёт номер.",
  "Вернулись к разговору о совместной поездке, решаем по датам до конца недели.",
  "Встретились случайно в центре, договорились не теряться.",
  "Собирает виниловые пластинки — идея для подарка.",
  "Попросить рецепт пирога.",
  "Запланировали созвон по итогам квартала.",
  "Договорились, что напишу после отпуска.",
  "Зовёт на дачу на майские, ответить до конца апреля.",
];

const emailDomains = ["example.com", "example.org", "example.net"];

// Typical trucks with the body types they usually come with.
const trucks: { tons: number; cubicMeters: number | null; bodyTypes: BodyType[] }[] = [
  { tons: 1.5, cubicMeters: 16, bodyTypes: ["tent", "van", "isothermal"] }, // "Газель"
  { tons: 5, cubicMeters: 36, bodyTypes: ["tent", "refrigerator", "isothermal", "flatbed"] },
  { tons: 10, cubicMeters: 50, bodyTypes: ["tent", "refrigerator", "flatbed"] },
  { tons: 20, cubicMeters: 82, bodyTypes: ["tent", "refrigerator", "isothermal", "van"] },
  { tons: 20, cubicMeters: 120, bodyTypes: ["tent"] }, // "Джамбо"
  { tons: 24, cubicMeters: 33, bodyTypes: ["container_carrier"] },
  { tons: 25, cubicMeters: 20, bodyTypes: ["dump_truck"] },
  { tons: 40, cubicMeters: null, bodyTypes: ["lowboy"] },
];

const TRUCK_SHARE = 0.35;

const translitMap: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

// Deterministic generator (mulberry32): every run produces the same contacts.
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20261010);
const chance = (probability: number) => random() < probability;
const randomInt = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const pick = <T>(items: readonly T[], next = random) => items[Math.floor(next() * items.length)];
const digits = (count: number) => Array.from({ length: count }, () => randomInt(0, 9)).join("");

// Trucks draw from their own generator, so the people and notes stay what they were before.
const truckRandom = createRandom(20261017);

function generateTruck() {
  if (truckRandom() >= TRUCK_SHARE) {
    return { capacityTons: null, volumeCubicMeters: null, bodyType: null };
  }
  const truck = pick(trucks, truckRandom);
  return {
    capacityTons: truck.tons,
    volumeCubicMeters: truck.cubicMeters,
    bodyType: pick(truck.bodyTypes, truckRandom),
  };
}

function feminineSurname(surname: string) {
  if (/(ов|ев|ёв|ин|ын)$/.test(surname)) return `${surname}а`;
  if (/(ский|цкий)$/.test(surname)) return `${surname.slice(0, -2)}ая`;
  return surname;
}

function transliterate(text: string) {
  return Array.from(text.toLowerCase(), (char) => translitMap[char] ?? char).join("");
}

function generateContacts(now: number) {
  const usedNames = new Set<string>();
  const result = [];

  while (result.length < CONTACT_COUNT) {
    const gender: Gender = chance(0.5) ? "male" : "female";
    const firstName = pick(gender === "male" ? maleFirstNames : femaleFirstNames);
    const surname = pick(surnames);
    const lastName = gender === "male" ? surname : feminineSurname(surname);
    const name = `${firstName} ${lastName}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);

    const createdAt = new Date(now - randomInt(1, 900) * DAY_MS - randomInt(0, DAY_MS));
    // "Кто это" follows the truck: a lowboy owner is not described as a tyre fitter.
    const truck = generateTruck();

    result.push({
      name,
      about: chance(0.9) ? generateAbout(gender, truck, random) : null,
      howWeMet: chance(0.85) ? pick(howWeMet) : null,
      phone: chance(0.9) ? `+7 000 ${digits(3)}-${digits(2)}-${digits(2)}` : null,
      email: chance(0.7)
        ? `${transliterate(firstName)}.${transliterate(lastName)}@${pick(emailDomains)}`
        : null,
      ...truck,
      createdAt,
    });
  }

  return result;
}

function generateNotes(contactId: number, contactCreatedAt: Date, now: number) {
  const roll = random();
  const count = roll < 0.35 ? 0 : roll < 0.7 ? 1 : roll < 0.9 ? 2 : 3;
  const from = contactCreatedAt.getTime();

  // A contact never gets the same note twice.
  const bodies = new Set<string>();
  while (bodies.size < count) {
    bodies.add(pick(noteBodies));
  }

  return Array.from(bodies, (body) => ({
    contactId,
    body,
    createdAt: new Date(from + Math.floor(random() * (now - from))),
  }));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    const existing = await db.$count(contacts);
    if (existing > 0) {
      console.log(`Contacts table already has ${existing} rows, nothing was added.`);
      return;
    }

    const now = Date.now();
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(contacts)
        .values(generateContacts(now))
        .returning({ id: contacts.id, createdAt: contacts.createdAt });

      const noteRows = inserted.flatMap((contact) =>
        generateNotes(contact.id, contact.createdAt, now),
      );
      await tx.insert(notes).values(noteRows);

      console.log(`Added ${inserted.length} contacts and ${noteRows.length} notes.`);
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
