@props(['reason' => null, 'unsubscribeUrl' => null])
<x-mail::layout>
    {{-- Header --}}
    <x-slot:header>
        <x-mail::header :url="config('app.url')">
            {{ __('mail.brand') }}
        </x-mail::header>
    </x-slot:header>

    {{-- Body --}}
    {{ $slot }}

    {{-- Footer --}}
    <x-slot:footer>
        <x-mail::footer>
            {{ __('mail.footer.safety', ['site' => config('app.url')]) }}

            {{ $reason }}
            @if ($unsubscribeUrl)
                {{ __('mail.footer.unsubscribe') }}: {{ $unsubscribeUrl }}
            @endif
        </x-mail::footer>
    </x-slot:footer>
</x-mail::layout>
