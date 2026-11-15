<x-mail::message :reason="$reason" :unsubscribe-url="$unsubscribeUrl">
# {{ __('mail.new_message.title', ['name' => $senderName]) }}

{{ __('mail.new_message.intro') }}

<x-mail::panel>
**{{ $listingTitle }}**@if ($price !== null)

{{ $price }}
@endif
</x-mail::panel>

<x-mail::button :url="$chatUrl">
{{ __('mail.new_message.cta') }}
</x-mail::button>

{{ __('mail.new_message.note') }}
</x-mail::message>
