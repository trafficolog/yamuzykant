<?php

declare(strict_types=1);

namespace App\Domain\Search;

use App\Domain\Catalog\Search\ModelAliases;
use Illuminate\Support\Str;

/**
 * Синтетические объявления для нагрузочной проверки поиска (3.1.1): схема документа та же, что у боевого индекса,
 * данные — правдоподобные (русские и латинские слова, 16 городов, ветки дерева категорий, цены от сотен до сотен тысяч).
 * Детерминированы: один и тот же номер даёт один и тот же документ, поэтому прогоны сравнимы.
 */
final class LoadData
{
    /** @var list<array{0: float, 1: float}> координаты городов; city_id = номер + 1 */
    public const CITIES = [
        [55.7558, 37.6173], [59.9343, 30.3351], [55.0084, 82.9357], [56.8389, 60.6057],
        [55.7887, 49.1221], [56.2965, 43.9361], [56.0153, 92.8932], [55.1644, 61.4368],
        [53.1959, 50.1002], [54.7388, 55.9721], [47.2357, 39.7015], [45.0355, 38.9753],
        [54.9885, 73.3242], [51.6720, 39.1843], [58.0105, 56.2294], [48.7080, 44.5133],
    ];

    /** @var list<array{0: string, 1: string, 2: string, 3: list<string>}> бренд, модель, слово для описания, пути категорий */
    private const MODELS = [
        ['Fender', 'American Vintage ’57 Stratocaster', 'гитара', ['gitary', 'gitary/elektrogitary']],
        ['Fender', 'Telecaster Player', 'гитара', ['gitary', 'gitary/elektrogitary']],
        ['Gibson', 'Les Paul Standard', 'гитара', ['gitary', 'gitary/elektrogitary']],
        ['Ibanez', 'RG550', 'гитара', ['gitary', 'gitary/elektrogitary']],
        ['Yamaha', 'FG830', 'гитара', ['gitary', 'gitary/akusticheskie']],
        ['Yamaha', 'C40', 'гитара', ['gitary', 'gitary/akusticheskie']],
        ['Fender', 'Precision Bass', 'бас-гитара', ['gitary', 'gitary/basy']],
        ['Boss', 'DS-1 Distortion', 'педаль', ['pedali-i-usiliteli', 'pedali-i-usiliteli/pedali']],
        ['Ibanez', 'Tube Screamer TS9', 'педаль', ['pedali-i-usiliteli', 'pedali-i-usiliteli/pedali']],
        ['Electro-Harmonix', 'Big Muff Pi', 'педаль', ['pedali-i-usiliteli', 'pedali-i-usiliteli/pedali']],
        ['Marshall', 'JCM800', 'усилитель', ['pedali-i-usiliteli', 'pedali-i-usiliteli/usiliteli']],
        ['Fender', 'Deluxe Reverb', 'комбоусилитель', ['pedali-i-usiliteli', 'pedali-i-usiliteli/usiliteli']],
        ['Roland', 'Juno-106', 'синтезатор', ['klavishnye', 'klavishnye/sintezatory']],
        ['Yamaha', 'P-125', 'цифровое пианино', ['klavishnye', 'klavishnye/piano']],
        ['Pearl', 'Export EXX', 'барабанная установка', ['udarnye', 'udarnye/ustanovki']],
        ['Shure', 'SM58', 'микрофон', ['studiya', 'studiya/mikrofony']],
    ];

    private const CONDITIONS = ['new', 'mint', 'excellent', 'very-good', 'good', 'fair', 'poor', 'parts'];

    private const WORDS = [
        'продаю', 'родной', 'кейс', 'в комплекте', 'струны', 'новые', 'играл', 'дома', 'без торга', 'торг уместен',
        'обмен', 'возможна доставка', 'самовывоз', 'состояние', 'отличное', 'царапины', 'на корпусе', 'после', 'ремонта',
        'настроена', 'электроника', 'работает', 'идеально', 'звук', 'чистый', 'винтаж', 'оригинал', 'документы', 'чек',
        'музыкальный', 'магазин', 'гарантия', 'сервис', 'регулировка', 'грифа', 'ладов', 'звукосниматели', 'хамбакеры',
    ];

    /** @return array<string, mixed> */
    public static function document(int $number): array
    {
        mt_srand($number * 7919 + 13);

        [$brand, $model, $kind, $path] = self::MODELS[mt_rand(0, count(self::MODELS) - 1)];
        $cityIndex = mt_rand(0, count(self::CITIES) - 1);
        [$lat, $lng] = self::CITIES[$cityIndex];

        $words = [];
        for ($i = mt_rand(12, 40); $i > 0; $i--) {
            $words[] = self::WORDS[mt_rand(0, count(self::WORDS) - 1)];
        }

        return [
            'id' => sprintf('%08x-0000-4000-8000-%012x', $number, $number * 2654435761 % 0xFFFFFFFFFFFF),
            'title' => $brand.' '.$model.' '.self::WORDS[mt_rand(0, count(self::WORDS) - 1)],
            'model' => $model,
            'brand' => $brand,
            'aliases' => ModelAliases::for($brand, $model),
            'description' => Str::ucfirst($kind.' '.implode(' ', $words)).'.',
            'category_path' => $path,
            'condition' => self::CONDITIONS[mt_rand(0, count(self::CONDITIONS) - 1)],
            'price' => (int) (round(exp(mt_rand(850, 1300) / 100) / 500) * 500),
            'city_id' => $cityIndex + 1,
            'ship' => mt_rand(0, 3) === 0,
            'negotiable' => mt_rand(0, 1) === 1,
            'published_at' => time() - mt_rand(0, 60 * 86400),
            '_geo' => ['lat' => $lat, 'lng' => $lng],
        ];
    }
}
