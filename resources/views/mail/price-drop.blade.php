<x-mail::message :reason="$reason" :unsubscribe-url="$unsubscribeUrl">
# {{ __('mail.price_drop.title') }}

{{ __('mail.price_drop.intro') }}

<x-mail::panel>
**{{ $title }}**@if ($price !== null)


{{ $price }}@if ($previousPrice !== null) · {{ __('mail.price_drop.was', ['price' => $previousPrice]) }}@endif
@endif
</x-mail::panel>

<x-mail::button :url="$listingUrl">
{{ __('mail.price_drop.cta') }}
</x-mail::button>
</x-mail::message>
