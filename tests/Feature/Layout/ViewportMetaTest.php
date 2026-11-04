<?php

declare(strict_types=1);

// 0.2.7: viewport-fit=cover нужен, чтобы safe-area (вырез iPhone) отдавалась через env() в шторке категорий.
it('отдаёт meta viewport с viewport-fit=cover', function () {
    $this->get('/')
        ->assertOk()
        ->assertSee('name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"', false);
});
