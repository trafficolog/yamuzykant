<?php

declare(strict_types=1);

namespace App\Http\Controllers\Messaging;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Queries\ConversationHistory;
use App\Domain\Messaging\Queries\UserConversations;
use App\Http\Controllers\Controller;
use App\Http\Resources\Messaging\ConversationListItemResource;
use App\Http\Resources\Messaging\ConversationResource;
use App\Http\Resources\Messaging\MessageResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Экран сообщений (4.1.2): список бесед и открытая беседа. Данные — страницей Inertia, дальше экран ходит
 * в JSON-эндпоинты 4.1.1 (отправка, история, «прочитано») и слушает каналы Reverb. Чужая беседа — 404.
 *
 * `/messages?listing={id}` — «Написать продавцу»: беседа создаётся первым сообщением, поэтому по объявлению без
 * беседы открывается черновик (`compose`), а по объявлению с беседой — она сама.
 */
final class MessagesPageController extends Controller
{
    public function index(Request $request, UserConversations $conversations): Response|RedirectResponse
    {
        $user = $this->user($request);
        $listingId = $request->query('listing');

        $compose = null;
        if ($listingId !== null) {
            $result = $this->compose($user, is_string($listingId) ? $listingId : '');
            if ($result instanceof RedirectResponse) {
                return $result;
            }
            $compose = $result;
        }

        return $this->page($request, $user, $conversations, null, $compose);
    }

    public function show(Request $request, Conversation $conversation, UserConversations $conversations, ConversationHistory $history): Response
    {
        abort_unless(Gate::forUser($request->user())->allows('view', $conversation), 404);

        $page = $history->page($conversation);
        $active = fn (): array => [
            'conversation' => (new ConversationResource($conversation))->resolve($request),
            'messages' => MessageResource::collection($page['messages'])->resolve($request),
            'has_more' => $page['has_more'],
        ];

        return $this->page($request, $this->user($request), $conversations, $active, null);
    }

    /**
     * Черновик по объявлению или переход: чужое опубликованное без беседы — черновик; беседа есть — в неё;
     * своё, не опубликованное и несуществующее — на список (без раскрытия, почему).
     *
     * @return array{listing: array{id: string, title: string|null, price: int|null}, counterpart: array{name: string}}|RedirectResponse
     */
    private function compose(User $user, string $listingId): array|RedirectResponse
    {
        $listing = Str::isUuid($listingId)
            ? Listing::query()->with('user')->find($listingId)
            : null;

        if ($listing === null || $listing->status !== ListingStatus::Published || $listing->user_id === $user->id) {
            return redirect()->route('messages.index');
        }

        $existing = Conversation::query()
            ->where('listing_id', $listing->id)
            ->where('buyer_id', $user->id)
            ->first();
        if ($existing !== null) {
            return redirect()->route('messages.show', $existing);
        }

        return [
            'listing' => ['id' => $listing->id, 'title' => $listing->title, 'price' => $listing->price],
            'counterpart' => ['name' => $listing->user->name],
        ];
    }

    /**
     * @param  (callable(): array<string, mixed>)|null  $active
     * @param  array<string, mixed>|null  $compose
     */
    private function page(Request $request, User $user, UserConversations $conversations, ?callable $active, ?array $compose): Response
    {
        return Inertia::render('Messages/Index', [
            'conversations' => fn (): array => ConversationListItemResource::collection($conversations->for($user))->resolve($request),
            'active' => $active,
            'compose' => $compose,
        ]);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
