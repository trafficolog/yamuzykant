<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Реальные модели инструментов по видам. Годы заполнены, только когда они известны точно.
 * Категория задаётся путём «вид / группа / пункт» из CategorySeeder.
 */
class InstrumentModelSeeder extends Seeder
{
    /**
     * @var list<array{0: string, 1: string, 2: int|null, 3: int|null, 4: string}>
     */
    private const MODELS = [
        // Гитары
        ['Fender', 'American Vintage ’57 Stratocaster', 2007, 2012, 'Гитары/Электрогитары/Stratocaster-тип'],
        ['Fender', 'Player Stratocaster', 2018, null, 'Гитары/Электрогитары/Stratocaster-тип'],
        ['Squier', 'Classic Vibe ’60s Stratocaster', null, null, 'Гитары/Электрогитары/Stratocaster-тип'],
        ['Fender', 'American Professional II Telecaster', 2020, null, 'Гитары/Электрогитары/Telecaster-тип'],
        ['Fender', 'Player Telecaster', 2018, null, 'Гитары/Электрогитары/Telecaster-тип'],
        ['Gibson', 'Les Paul Studio', 1983, 2018, 'Гитары/Электрогитары/Les Paul-тип'],
        ['Gibson', 'Les Paul Standard ’60s', null, null, 'Гитары/Электрогитары/Les Paul-тип'],
        ['Epiphone', 'Les Paul Standard', null, null, 'Гитары/Электрогитары/Les Paul-тип'],
        ['Ibanez', 'RG550', null, null, 'Гитары/Электрогитары/Суперстраты'],
        ['Gibson', 'ES-335', 1958, null, 'Гитары/Электрогитары/Полуакустические'],
        ['Martin', 'D-28', 1931, null, 'Гитары/Акустические гитары/Вестерн'],
        ['Yamaha', 'FG800', null, null, 'Гитары/Акустические гитары/Вестерн'],
        ['Yamaha', 'C40', null, null, 'Гитары/Акустические гитары/Классические'],
        ['Fender', 'Player Precision Bass', 2018, null, 'Гитары/Бас-гитары/4-струнные'],
        ['Fender', 'Player Jazz Bass', 2018, null, 'Гитары/Бас-гитары/4-струнные'],
        ['Ibanez', 'SR305E', null, null, 'Гитары/Бас-гитары/5-струнные'],
        // Педали и усилители
        ['Boss', 'DS-1 Distortion', 1978, null, 'Педали и усилители/Педали эффектов/Овердрайв и дисторшн'],
        ['Ibanez', 'Tube Screamer TS9', 1982, 1985, 'Педали и усилители/Педали эффектов/Овердрайв и дисторшн'],
        ['ProCo', 'RAT 2', 1987, null, 'Педали и усилители/Педали эффектов/Овердрайв и дисторшн'],
        ['Dunlop', 'Fuzz Face', 1966, null, 'Педали и усилители/Педали эффектов/Фузз'],
        ['Electro-Harmonix', 'Big Muff Pi', 1969, null, 'Педали и усилители/Педали эффектов/Фузз'],
        ['Strymon', 'Timeline', 2012, null, 'Педали и усилители/Педали эффектов/Дилэй и ревербератор'],
        ['Boss', 'DD-3 Digital Delay', 1986, null, 'Педали и усилители/Педали эффектов/Дилэй и ревербератор'],
        ['MXR', 'Phase 90', 1974, null, 'Педали и усилители/Педали эффектов/Модуляция'],
        ['Line 6', 'Helix', 2015, null, 'Педали и усилители/Процессоры и мультиэффекты/Напольные'],
        ['Fender', 'Hot Rod Deluxe', 1996, null, 'Педали и усилители/Гитарные усилители/Ламповые комбо'],
        ['Vox', 'AC30', 1958, null, 'Педали и усилители/Гитарные усилители/Ламповые комбо'],
        ['Marshall', 'JCM800 2203', null, null, 'Педали и усилители/Гитарные усилители/Головы'],
        ['Ampeg', 'SVT', 1969, null, 'Педали и усилители/Басовые усилители/Головы'],
        // Клавишные и синтезаторы
        ['Roland', 'Juno-106', 1984, 1985, 'Клавишные и синтезаторы/Синтезаторы/Аналоговые'],
        ['Korg', 'MS-20', 1978, null, 'Клавишные и синтезаторы/Синтезаторы/Аналоговые'],
        ['Moog', 'Minimoog Model D', 1970, 1981, 'Клавишные и синтезаторы/Синтезаторы/Винтажные'],
        ['Yamaha', 'DX7', 1983, 1989, 'Клавишные и синтезаторы/Синтезаторы/Цифровые'],
        ['Yamaha', 'P-125', null, null, 'Клавишные и синтезаторы/Цифровые пианино/Домашние'],
        ['Roland', 'FP-30X', null, null, 'Клавишные и синтезаторы/Цифровые пианино/Домашние'],
        ['Akai', 'MPK Mini MK3', null, null, 'Клавишные и синтезаторы/MIDI-клавиатуры/25–37 клавиш'],
        ['Roland', 'TR-808', 1980, 1983, 'Клавишные и синтезаторы/Драм-машины и семплеры/Драм-машины'],
        ['Elektron', 'Digitakt', 2017, null, 'Клавишные и синтезаторы/Драм-машины и семплеры/Семплеры'],
        // Студия и запись
        ['Shure', 'SM58', 1966, null, 'Студия и запись/Микрофоны/Динамические'],
        ['Neumann', 'U 87 Ai', null, null, 'Студия и запись/Микрофоны/Конденсаторные'],
        ['Focusrite', 'Scarlett 2i2', null, null, 'Студия и запись/Звуковые карты/USB'],
        ['Yamaha', 'HS8', null, null, 'Студия и запись/Мониторы и наушники/Студийные мониторы'],
        ['Beyerdynamic', 'DT 770 Pro', null, null, 'Студия и запись/Мониторы и наушники/Закрытые наушники'],
        // Ударные
        ['Ludwig', 'Supraphonic LM402', null, null, 'Ударные/Акустические установки/Малые барабаны'],
        ['Zildjian', 'A Custom Crash', null, null, 'Ударные/Акустические установки/Тарелки'],
        ['Roland', 'TD-17KVX', null, null, 'Ударные/Электронные установки/Установки'],
        // Духовые
        ['Yamaha', 'YAS-280', null, null, 'Духовые/Деревянные/Саксофоны'],
        ['Hohner', 'Marine Band 1896', 1896, null, 'Духовые/Губные гармоники/Диатонические'],
        // Смычковые
        ['Stentor', 'Student I', null, null, 'Смычковые/Инструменты/Скрипки'],
        // DJ-оборудование
        ['Pioneer DJ', 'DDJ-400', null, null, 'DJ-оборудование/Контроллеры/2-канальные'],
        ['Pioneer DJ', 'CDJ-2000NXS2', null, null, 'DJ-оборудование/Проигрыватели/CDJ и медиаплееры'],
        ['Technics', 'SL-1200MK2', 1979, 2010, 'DJ-оборудование/Проигрыватели/Виниловые'],
    ];

    public function run(): void
    {
        foreach (self::MODELS as [$brand, $name, $from, $to, $path]) {
            $model = InstrumentModel::query()->firstOrNew(['brand' => $brand, 'name' => $name]);

            // Статус задаётся только при создании: модерация и скрытие из консоли повторный сид не отменяет.
            if (! $model->exists) {
                $model->status = InstrumentModelStatus::Active;
            }

            $model->fill([
                'year_from' => $from,
                'year_to' => $to,
                'category_id' => $this->categoryId($path),
            ])->save();
        }
    }

    /** Находит категорию по пути «вид/группа/пункт». */
    private function categoryId(string $path): int
    {
        $parentId = null;
        foreach (explode('/', $path) as $name) {
            $parentId = Category::query()
                ->where('parent_id', $parentId)
                ->where('name', $name)
                ->value('id');

            if ($parentId === null) {
                throw new RuntimeException("Нет категории «{$name}» в пути «{$path}»: сначала запустите CategorySeeder.");
            }
        }

        return (int) $parentId;
    }
}
