<?php

declare(strict_types=1);

namespace Tests\Support;

use Illuminate\Cache\ArrayStore;

/** Массив в памяти с атомарным «добавить, если нет» — как SETNX в Redis (для NoReadCache). */
final class AtomicArrayStore extends ArrayStore
{
    /**
     * @param  string  $key
     * @param  mixed  $value
     * @param  int  $seconds
     */
    public function add($key, $value, $seconds): bool
    {
        if (parent::get($key) !== null) {
            return false;
        }

        return $this->put($key, $value, $seconds);
    }
}
