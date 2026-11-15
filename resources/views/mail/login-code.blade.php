<x-mail::message :reason="__('mail.reasons.login_code')">
# {{ __('login.mail.title') }}

{{ __('login.mail.intro', ['minutes' => $minutes]) }}

<x-mail::panel>
# {{ $code }}
</x-mail::panel>

{{ __('login.mail.ignore') }}
</x-mail::message>
