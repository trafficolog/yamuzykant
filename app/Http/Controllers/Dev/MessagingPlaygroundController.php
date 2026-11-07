<?php

declare(strict_types=1);

namespace App\Http\Controllers\Dev;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Queries\ConversationHistory;
use App\Http\Controllers\Controller;
use App\Http\Resources\Messaging\ConversationResource;
use App\Http\Resources\Messaging\MessageResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Служебная страница для e2e UC-D1 «сообщение доходит до второй вкладки ≤ 2 с» до экрана сообщений (4.1.2).
 * Только local, testing и e2e; на stage и в production — 404.
 */
final class MessagingPlaygroundController extends Controller
{
    /** Опубликованное объявление вошедшего продавца, по которому покупатель начнёт беседу. */
    public function listing(Request $request, ListingStateMachine $machine): Response
    {
        $this->ensurePlaygroundEnvironment();

        /** @var User $user */
        $user = $request->user();
        $listing = Listing::query()->where('user_id', $user->id)->where('status', ListingStatus::Published->value)->oldest()->first();
        if ($listing === null) {
            $draft = new Listing;
            $draft->user_id = $user->id;
            // Без города: в выдаче Барахолки и рельсах главной (они по городу) объявление не появляется.
            $draft->fill(['title' => 'Fender ’57 Stratocaster', 'price' => 184_500]);
            $draft->save();
            $listing = $machine->publish($draft);
        }

        return Inertia::render('Dev/MessagingPlayground', [
            'listingId' => $listing->id,
            'conversation' => null,
            'messages' => [],
        ]);
    }

    public function conversation(Request $request, Conversation $conversation, ConversationHistory $history): Response
    {
        $this->ensurePlaygroundEnvironment();
        abort_unless(Gate::forUser($request->user())->allows('view', $conversation), 404);

        return Inertia::render('Dev/MessagingPlayground', [
            'listingId' => $conversation->listing_id,
            'conversation' => (new ConversationResource($conversation))->resolve($request),
            'messages' => MessageResource::collection($history->page($conversation)['messages'])->resolve($request),
        ]);
    }

    private function ensurePlaygroundEnvironment(): void
    {
        abort_unless(app()->environment(['local', 'testing', 'e2e']), 404);
    }
}
