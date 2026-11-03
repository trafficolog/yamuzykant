<x-mail::message>
{{ __('login.mail.intro') }}

<x-mail::panel>
# {{ $code }}
</x-mail::panel>

{{ __('login.mail.expires', ['minutes' => $minutes]) }}

{{ __('login.mail.ignore') }}
</x-mail::message>
