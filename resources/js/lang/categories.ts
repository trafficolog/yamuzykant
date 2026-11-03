import type { IconName } from '@ds';

import type { FlagName } from '@/Hooks/useFlag';
import { ru } from '@/lang/ru';

/** Группа ссылок во втором уровне меню категорий. */
export interface CategoryGroup {
    title: string;
    items: readonly string[];
    /** Сколько позиций не поместилось: «Ещё N». */
    more?: number;
}

/** Пункт блока «Сервисы» в меню категорий. Без `flag` показывается всегда. */
export interface CategoryService {
    icon: IconName;
    label: string;
    flag?: FlagName;
}

/** Вид инструмента — первый уровень меню категорий. */
export interface CategoryNode {
    name: string;
    icon: IconName;
    /** Раздел вне MVP: вид скрыт, пока флаг выключен. */
    flag?: FlagName;
    services: readonly CategoryService[];
    groups: readonly CategoryGroup[];
}

const t = ru.categoryMenu.services;

/** Сервисы вида по умолчанию: «Цены продаж: …», «Продать …» зависят от названия вида. */
const servicesFor = (kind: string): readonly CategoryService[] => [
    { icon: 'badge-check', label: t.masterCheck, flag: 'masters' },
    { icon: 'sliders-horizontal', label: t.salePrices(kind), flag: 'sale_prices' },
    { icon: 'shield-check', label: t.safeDeal, flag: 'safe_deal' },
    { icon: 'truck', label: t.delivery, flag: 'delivery_service' },
    { icon: 'plus', label: t.sell(kind) },
];

/**
 * Дерево категорий из макета «Шапка». Пока справочник не подключён (задача 1.2.1), это
 * значение по умолчанию для `SiteHeader`; позже шапка получит дерево пропсом с сервера.
 */
export const CATEGORY_TREE: readonly CategoryNode[] = [
    {
        name: 'Гитары',
        icon: 'guitar',
        services: servicesFor('гитары'),
        groups: [
            {
                title: 'Электрогитары',
                items: [
                    'Stratocaster-тип',
                    'Telecaster-тип',
                    'Les Paul-тип',
                    'Суперстраты',
                    'Полуакустические',
                ],
                more: 4,
            },
            {
                title: 'Акустические гитары',
                items: ['Вестерн', 'Классические', 'Электроакустические', 'Укулеле'],
            },
            {
                title: 'Бас-гитары',
                items: ['4-струнные', '5-струнные', 'Безладовые', 'Акустические бас-гитары'],
            },
            {
                title: 'Звукосниматели и электроника',
                items: ['Синглы', 'Хамбакеры', 'Активные'],
                more: 3,
            },
        ],
    },
    {
        name: 'Педали и усилители',
        icon: 'cable',
        services: servicesFor('педали'),
        groups: [
            {
                title: 'Педали эффектов',
                items: [
                    'Овердрайв и дисторшн',
                    'Фузз',
                    'Дилэй и ревербератор',
                    'Модуляция',
                    'Луперы',
                ],
                more: 6,
            },
            {
                title: 'Процессоры и мультиэффекты',
                items: ['Напольные', 'Моделирующие'],
                more: 2,
            },
            {
                title: 'Гитарные усилители',
                items: ['Ламповые комбо', 'Транзисторные комбо', 'Головы', 'Кабинеты'],
            },
            { title: 'Басовые усилители', items: ['Комбо', 'Головы', 'Кабинеты'] },
        ],
    },
    {
        name: 'Клавишные и синтезаторы',
        icon: 'piano',
        services: servicesFor('синтезатор'),
        groups: [
            {
                title: 'Синтезаторы',
                items: ['Аналоговые', 'Цифровые', 'Модульные и Eurorack', 'Винтажные'],
            },
            { title: 'Цифровые пианино', items: ['Домашние', 'Сценические'], more: 2 },
            { title: 'MIDI-клавиатуры', items: ['25–37 клавиш', '49–61 клавиша', '88 клавиш'] },
            {
                title: 'Драм-машины и семплеры',
                items: ['Драм-машины', 'Семплеры', 'Грувбоксы'],
            },
        ],
    },
    {
        name: 'Студия и запись',
        icon: 'mic',
        services: servicesFor('оборудование'),
        groups: [
            { title: 'Микрофоны', items: ['Конденсаторные', 'Динамические', 'Ленточные'] },
            { title: 'Звуковые карты', items: ['USB', 'Thunderbolt'], more: 2 },
            {
                title: 'Мониторы и наушники',
                items: ['Студийные мониторы', 'Закрытые наушники', 'Открытые наушники'],
            },
            { title: 'Микшеры и пульты', items: ['Аналоговые', 'Цифровые', 'Портастудии'] },
        ],
    },
    {
        name: 'Ударные',
        icon: 'drum',
        services: servicesFor('ударные'),
        groups: [
            {
                title: 'Акустические установки',
                items: ['Полные установки', 'Малые барабаны', 'Тарелки'],
                more: 3,
            },
            { title: 'Электронные установки', items: ['Установки', 'Пэды', 'Звуковые модули'] },
            { title: 'Перкуссия', items: ['Кахоны', 'Джембе'], more: 5 },
            { title: 'Стойки и аксессуары', items: ['Стойки', 'Педали', 'Палочки'] },
        ],
    },
    {
        name: 'Духовые',
        icon: 'mic',
        services: servicesFor('духовые'),
        groups: [
            { title: 'Деревянные', items: ['Саксофоны', 'Флейты', 'Кларнеты'] },
            { title: 'Медные', items: ['Трубы', 'Тромбоны'], more: 2 },
            {
                title: 'Губные гармоники',
                items: ['Диатонические', 'Хроматические', 'Мелодики'],
            },
        ],
    },
    {
        name: 'Смычковые',
        icon: 'guitar',
        services: servicesFor('смычковые'),
        groups: [
            { title: 'Инструменты', items: ['Скрипки', 'Альты', 'Виолончели', 'Контрабасы'] },
            { title: 'Смычки и аксессуары', items: ['Смычки', 'Канифоль', 'Футляры'] },
        ],
    },
    {
        name: 'DJ-оборудование',
        icon: 'headphones',
        services: servicesFor('DJ-оборудование'),
        groups: [
            { title: 'Контроллеры', items: ['2-канальные', '4-канальные', 'Автономные'] },
            { title: 'Проигрыватели', items: ['Виниловые', 'CDJ и медиаплееры'] },
            { title: 'DJ-микшеры', items: ['Клубные', 'Баттл-микшеры'] },
        ],
    },
    {
        name: 'Аксессуары и запчасти',
        icon: 'package',
        flag: 'accessories',
        services: servicesFor('аксессуары'),
        groups: [
            {
                title: 'Струны',
                items: ['Для электрогитар', 'Для акустики', 'Для бас-гитар'],
            },
            { title: 'Кейсы и чехлы', items: ['Жёсткие кейсы', 'Мягкие чехлы', 'Рэки'] },
            {
                title: 'Кабели и стойки',
                items: ['Инструментальные кабели', 'Патч-кабели', 'Стойки'],
            },
            { title: 'Запчасти', items: ['Колки', 'Порожки', 'Бриджи'], more: 8 },
        ],
    },
    {
        name: 'Мастера и ремонт',
        icon: 'wrench',
        flag: 'masters',
        services: [
            { icon: 'badge-check', label: 'Проверка перед покупкой' },
            { icon: 'locate-fixed', label: 'Мастера рядом с вами' },
            { icon: 'calendar-clock', label: 'Записаться на ремонт' },
            {
                icon: 'shield-check',
                label: 'Оплата ремонта через безопасную сделку',
                flag: 'safe_deal',
            },
        ],
        groups: [
            {
                title: 'Гитары',
                items: ['Настройка', 'Перешлифовка ладов', 'Электрика', 'Ремонт трещин'],
            },
            {
                title: 'Усилители и педали',
                items: ['Ламповые усилители', 'Транзисторные', 'Педали'],
            },
            { title: 'Клавишные', items: ['Ремонт клавиатуры', 'Сервис синтезаторов'] },
            { title: 'Ударные и духовые', items: ['Ударные', 'Духовые'] },
        ],
    },
];
