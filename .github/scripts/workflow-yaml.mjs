// Разбор workflow GitHub Actions и вычисление выражений `if` без зависимостей:
// job docs в CI работает без `npm ci`, поэтому пакет yaml недоступен.
// Поддерживается подмножество YAML, которым написаны .github/workflows: блочные
// словари и списки, однострочные [a, b] и { a: b }, строки в кавычках, блочные
// строки | и >, комментарии. Выражения — подмножество синтаксиса GitHub
// (https://docs.github.com/actions/learn-github-actions/expressions).

// ---------- YAML ----------

const stripComment = (line) => {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
            if (c === quote) {
                if (quote === "'" && line[i + 1] === "'") i++;
                else quote = null;
            } else if (c === '\\' && quote === '"') i++;
        } else if (c === '"' || c === "'") {
            if (i === 0 || /[\s[{,:]/.test(line[i - 1])) quote = c;
        } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
            return line.slice(0, i).replace(/\s+$/, '');
        }
    }
    return line.replace(/\s+$/, '');
};

// Индекс разделителя «ключ: значение» вне кавычек и скобок, иначе -1.
const findColon = (text) => {
    let quote = null;
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quote) {
            if (c === quote) {
                if (quote === "'" && text[i + 1] === "'") i++;
                else quote = null;
            } else if (c === '\\' && quote === '"') i++;
        } else if ((c === '"' || c === "'") && (i === 0 || /[\s[{,]/.test(text[i - 1]))) quote = c;
        else if (c === '[' || c === '{') depth++;
        else if (c === ']' || c === '}') depth--;
        else if (c === ':' && depth === 0 && (i === text.length - 1 || text[i + 1] === ' '))
            return i;
    }
    return -1;
};

const splitFlow = (body) => {
    const parts = [];
    let quote = null;
    let depth = 0;
    let start = 0;
    for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (quote) {
            if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === '[' || c === '{') depth++;
        else if (c === ']' || c === '}') depth--;
        else if (c === ',' && depth === 0) {
            parts.push(body.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(body.slice(start));
    return parts.map((p) => p.trim()).filter((p) => p !== '');
};

const scalar = (raw) => {
    const text = raw.trim();
    if (text === '') return null;
    if (text.startsWith("'") && text.endsWith("'") && text.length > 1)
        return text.slice(1, -1).replace(/''/g, "'");
    if (text.startsWith('"') && text.endsWith('"') && text.length > 1) return JSON.parse(text);
    if (text.startsWith('[') && text.endsWith(']')) return splitFlow(text.slice(1, -1)).map(scalar);
    if (text.startsWith('{') && text.endsWith('}') && !text.startsWith('{{')) {
        const map = {};
        for (const part of splitFlow(text.slice(1, -1))) {
            const at = findColon(part);
            if (at < 0) throw new Error(`YAML: ожидалось «ключ: значение» в { ${part} }`);
            map[scalar(part.slice(0, at))] = scalar(part.slice(at + 1));
        }
        return map;
    }
    if (text === 'null' || text === '~') return null;
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    return text;
};

export function parseYaml(source) {
    const lines = source
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((raw) => ({ raw, text: stripComment(raw) }))
        .map((l) => ({
            ...l,
            indent: l.text.length - l.text.trimStart().length,
            body: l.text.trim(),
        }));
    let pos = 0;

    const skipBlank = () => {
        while (pos < lines.length && lines[pos].body === '') pos++;
    };

    const blockScalar = (header, parentIndent) => {
        const folded = header.startsWith('>');
        const chomp = header.includes('-') ? 'strip' : header.includes('+') ? 'keep' : 'clip';
        const out = [];
        let indent = null;
        while (pos < lines.length) {
            const { raw } = lines[pos];
            if (raw.trim() === '') {
                out.push('');
                pos++;
                continue;
            }
            const ind = raw.length - raw.trimStart().length;
            if (ind <= parentIndent) break;
            if (indent === null) indent = ind;
            if (ind < indent) break;
            out.push(raw.slice(indent).replace(/\s+$/, ''));
            pos++;
        }
        while (out.length && out[out.length - 1] === '') out.pop();
        const text = folded
            ? out.reduce((acc, l) => (acc === '' ? l : l === '' ? `${acc}\n` : `${acc} ${l}`), '')
            : out.join('\n');
        return chomp === 'strip' ? text : `${text}\n`;
    };

    // Значение после «ключ:» или «- »: строка в той же строке либо вложенный блок.
    const value = (rest, ownIndent) => {
        if (rest === '') {
            skipBlank();
            if (pos >= lines.length) return null;
            const next = lines[pos];
            if (
                next.indent > ownIndent ||
                (next.indent === ownIndent && next.body.startsWith('- '))
            ) {
                return block(next.indent);
            }
            return null;
        }
        if (/^[|>][-+]?$/.test(rest)) return blockScalar(rest, ownIndent);
        return scalar(rest);
    };

    const mapping = (indent, first = null) => {
        const map = {};
        const entry = (body) => {
            const at = findColon(body);
            if (at < 0) throw new Error(`YAML: строка ${pos}: ожидалось «ключ: значение»: ${body}`);
            const key = scalar(body.slice(0, at));
            if (Object.hasOwn(map, key)) throw new Error(`YAML: повтор ключа ${key}`);
            map[key] = value(body.slice(at + 1).trim(), indent);
        };
        if (first !== null) entry(first);
        for (;;) {
            skipBlank();
            if (pos >= lines.length) break;
            const line = lines[pos];
            if (line.indent < indent) break;
            if (line.indent > indent) throw new Error(`YAML: строка ${pos + 1}: лишний отступ`);
            if (line.body.startsWith('- ') || line.body === '-') break;
            pos++;
            entry(line.body);
        }
        return map;
    };

    const sequence = (indent) => {
        const list = [];
        for (;;) {
            skipBlank();
            if (pos >= lines.length) break;
            const line = lines[pos];
            if (line.indent !== indent || !(line.body.startsWith('- ') || line.body === '-')) break;
            pos++;
            const rest = line.body.slice(1).trim();
            const itemIndent =
                indent +
                (line.text.trimStart().length - line.text.trimStart().slice(1).trimStart().length);
            if (rest !== '' && findColon(rest) >= 0 && !/^[[{'"]/.test(rest))
                list.push(mapping(itemIndent, rest));
            else list.push(value(rest, indent));
        }
        return list;
    };

    const block = (indent) =>
        lines[pos].body.startsWith('- ') || lines[pos].body === '-'
            ? sequence(indent)
            : mapping(indent);

    skipBlank();
    if (pos >= lines.length) return null;
    const doc = block(lines[pos].indent);
    skipBlank();
    if (pos < lines.length) throw new Error(`YAML: строка ${pos + 1}: не разобрана`);
    return doc;
}

// ---------- Выражения ----------

const TOKEN =
    /\s*(?:(\$\{\{)|(\}\})|('(?:[^']|'')*')|(\d+(?:\.\d+)?)|(==|!=|<=|>=|&&|\|\||[!<>()[\],.*])|([A-Za-z_][A-Za-z0-9_-]*))/y;

const tokenize = (src) => {
    const out = [];
    TOKEN.lastIndex = 0;
    while (TOKEN.lastIndex < src.length) {
        if (/^\s*$/.test(src.slice(TOKEN.lastIndex))) break;
        const at = TOKEN.lastIndex;
        const m = TOKEN.exec(src);
        if (!m) throw new Error(`Выражение: не разобрано с позиции ${at}: ${src}`);
        if (m[1] || m[2]) continue;
        if (m[3]) out.push({ t: 'str', v: m[3].slice(1, -1).replace(/''/g, "'") });
        else if (m[4]) out.push({ t: 'num', v: Number(m[4]) });
        else if (m[5]) out.push({ t: 'op', v: m[5] });
        else out.push({ t: 'id', v: m[6] });
    }
    return out;
};

const toNumber = (v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return v.trim() === '' ? 0 : Number(v);
    return NaN;
};

const toStr = (v) =>
    v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

const truthy = (v) =>
    !(v === null || v === undefined || v === false || v === 0 || v === '' || Number.isNaN(v));

// Сравнение по правилам GitHub: строки — без учёта регистра, разные типы — через число.
const looseEqual = (a, b) => {
    const na = a === undefined ? null : a;
    const nb = b === undefined ? null : b;
    if (typeof na === 'string' && typeof nb === 'string')
        return na.toLowerCase() === nb.toLowerCase();
    if (typeof na === typeof nb && (na === null || typeof na !== 'object')) return na === nb;
    if (typeof na === 'object' && na !== null && typeof nb === 'object' && nb !== null)
        return na === nb;
    return toNumber(na) === toNumber(nb);
};

const FUNCTIONS = {
    startsWith: (a, b) => toStr(a).toLowerCase().startsWith(toStr(b).toLowerCase()),
    endsWith: (a, b) => toStr(a).toLowerCase().endsWith(toStr(b).toLowerCase()),
    contains: (a, b) =>
        Array.isArray(a)
            ? a.some((x) => looseEqual(x, b))
            : toStr(a).toLowerCase().includes(toStr(b).toLowerCase()),
    format: (f, ...args) => toStr(f).replace(/\{(\d+)\}/g, (_, i) => toStr(args[Number(i)])),
    toJSON: (v) => JSON.stringify(v),
    fromJSON: (v) => JSON.parse(toStr(v)),
};

/**
 * Вычисляет выражение `if` (с `${{ }}` или без) в контексте {github, inputs, needs, …}.
 * Статус-функции: success() — true, always() — true, failure() и cancelled() — false.
 */
export function evaluate(expression, context, status = {}) {
    const statusFns = { success: true, always: true, failure: false, cancelled: false, ...status };
    const tokens = tokenize(String(expression));
    let i = 0;
    const peek = () => tokens[i];
    const isOp = (v) => tokens[i] && tokens[i].t === 'op' && tokens[i].v === v;
    const expect = (v) => {
        if (!isOp(v)) throw new Error(`Выражение: ожидалось ${v}: ${expression}`);
        i++;
    };

    const primary = () => {
        const tok = peek();
        if (!tok) throw new Error(`Выражение оборвано: ${expression}`);
        i++;
        if (tok.t === 'str' || tok.t === 'num') return tok.v;
        if (tok.t === 'op' && tok.v === '(') {
            const v = or();
            expect(')');
            return v;
        }
        if (tok.t !== 'id') throw new Error(`Выражение: неожиданный ${tok.v}: ${expression}`);
        if (tok.v === 'true') return true;
        if (tok.v === 'false') return false;
        if (tok.v === 'null') return null;
        if (isOp('(')) {
            i++;
            const args = [];
            while (!isOp(')')) {
                args.push(or());
                if (isOp(',')) i++;
            }
            expect(')');
            if (Object.hasOwn(statusFns, tok.v)) return statusFns[tok.v];
            const fn = FUNCTIONS[tok.v];
            if (!fn) throw new Error(`Выражение: неизвестная функция ${tok.v}`);
            return fn(...args);
        }
        let v = context[tok.v];
        let star = false; // после `.*` следующие `.имя` берутся у каждого элемента (labels.*.name)
        for (;;) {
            if (isOp('.')) {
                i++;
                const name = peek();
                i++;
                if (name.v === '*') {
                    star = true;
                    v = v === null || v === undefined ? [] : Object.values(v);
                } else if (star) {
                    v = v.map((x) => (x === null || x === undefined ? null : x[name.v]));
                } else v = v === null || v === undefined ? null : v[name.v];
            } else if (isOp('[')) {
                i++;
                const key = or();
                expect(']');
                v = v === null || v === undefined ? null : v[key];
            } else break;
        }
        return v === undefined ? null : v;
    };

    const unary = () => {
        if (isOp('!')) {
            i++;
            return !truthy(unary());
        }
        return primary();
    };

    const comparison = () => {
        let left = unary();
        while (
            peek() &&
            peek().t === 'op' &&
            ['==', '!=', '<', '>', '<=', '>='].includes(peek().v)
        ) {
            const op = peek().v;
            i++;
            const right = unary();
            if (op === '==') left = looseEqual(left, right);
            else if (op === '!=') left = !looseEqual(left, right);
            else {
                const [a, b] = [toNumber(left), toNumber(right)];
                left = op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
            }
        }
        return left;
    };

    const and = () => {
        let left = comparison();
        while (isOp('&&')) {
            i++;
            const right = comparison();
            left = truthy(left) ? right : left;
        }
        return left;
    };

    function or() {
        let left = and();
        while (isOp('||')) {
            i++;
            const right = and();
            left = truthy(left) ? left : right;
        }
        return left;
    }

    const result = or();
    if (i < tokens.length) throw new Error(`Выражение: лишнее после позиции ${i}: ${expression}`);
    return result;
}

export const STATUS_FUNCTION = /\b(success|always|failure|cancelled)\s*\(/;

/**
 * Запустится ли job. Как в GitHub: `if` без статус-функции неявно получает `success() &&`,
 * без `if` — `success()`. status — результат needs: {success, failure} (по умолчанию все needs успешны).
 */
export function jobRuns(job, context, status = {}) {
    const raw = job.if === undefined || job.if === null ? '' : String(job.if);
    const body = raw.trim().replace(/^\$\{\{([\s\S]*)\}\}$/, '$1');
    const condition =
        body.trim() === ''
            ? 'success()'
            : STATUS_FUNCTION.test(body)
              ? body
              : `success() && (${body})`;
    return truthy(evaluate(condition, context, status));
}
