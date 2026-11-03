<?php

declare(strict_types=1);

namespace Tests\Support;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/**
 * Ищет прямую запись статуса в PHP-коде (AGENTS.md §4): статус меняет только *StateMachine.
 *
 * Ловит: `->status = …`, `->status ??= …`, `['status'] = …`, `->setAttribute('status', …)`,
 * `update/fill/forceFill/updateOrCreate/upsert/…(['status' => …])` и SQL `SET status = …`.
 * Комментарии перед поиском вырезаются, строки остаются (ключ 'status' — строка).
 */
final class StatusWriteScanner
{
    private const PATTERNS = [
        'присваивание ->status' => '/->\s*status\s*(?:\?\?=|=(?![=>]))/',
        'присваивание [\'status\']' => '/\[\s*[\'"]status[\'"]\s*\]\s*(?:\?\?=|=(?![=>]))/',
        'setAttribute(\'status\')' => '/->\s*setAttribute\s*\(\s*[\'"]status[\'"]/',
        'массовая запись status' => '/->\s*(?:update|updateQuietly|updateOrFail|fill|forceFill|forceFillQuietly|setRawAttributes|updateOrCreate|updateOrInsert|upsert|incrementEach)\s*\([^;]*?[\'"]status[\'"]\s*=>/s',
        'SQL SET status' => '/\bset\s+[`"]?status[`"]?\s*=/i',
    ];

    /**
     * Нарушения в исходном коде: список «строка: правило».
     *
     * @return list<string>
     */
    public static function scan(string $code): array
    {
        $code = self::withoutComments($code);
        $found = [];
        foreach (self::PATTERNS as $rule => $pattern) {
            if (preg_match_all($pattern, $code, $matches, PREG_OFFSET_CAPTURE) > 0) {
                foreach ($matches[0] as [, $offset]) {
                    $found[] = (substr_count($code, "\n", 0, $offset) + 1).': '.$rule;
                }
            }
        }

        return $found;
    }

    /**
     * Нарушения во всех PHP-файлах каталога, кроме каталогов StateMachines.
     *
     * @return array<string, list<string>> путь → нарушения
     */
    public static function scanDirectory(string $root): array
    {
        $violations = [];
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS));
        /** @var SplFileInfo $file */
        foreach ($files as $file) {
            $path = str_replace('\\', '/', $file->getPathname());
            if ($file->getExtension() !== 'php' || str_contains($path, '/StateMachines/')) {
                continue;
            }
            $found = self::scan((string) file_get_contents($path));
            if ($found !== []) {
                $violations[$path] = $found;
            }
        }

        return $violations;
    }

    private static function withoutComments(string $code): string
    {
        $result = '';
        foreach (token_get_all($code) as $token) {
            if (is_array($token)) {
                // Переводы строк комментария сохраняются, чтобы номера строк совпадали с файлом.
                $result .= in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)
                    ? str_repeat("\n", substr_count($token[1], "\n"))
                    : $token[1];
            } else {
                $result .= $token;
            }
        }

        return $result;
    }
}
