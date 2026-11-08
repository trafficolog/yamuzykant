<?php

declare(strict_types=1);

namespace App\Http\Controllers\Messaging;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\Actions\MarkConversationRead;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Messaging\Actions\StartConversation;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Queries\ConversationHistory;
use App\Domain\Messaging\Queries\UnreadMessages;
use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\SendMessageRequest;
use App\Http\Resources\Messaging\ConversationResource;
use App\Http\Resources\Messaging\MessageResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * JSON-эндпоинты сообщений (4.1.1) для экрана сообщений (4.1.2). Чужая беседа — 404, а не 403:
 * существование беседы по id не раскрывается (IDOR). Ошибки домена — bootstrap/app.php.
 */
final class ConversationController extends Controller
{
    /** «Написать продавцу»: первое сообщение создаёт беседу, повторное — продолжает. */
    public function store(SendMessageRequest $request, Listing $listing, StartConversation $action): JsonResponse
    {
        $message = $action->handle($this->user($request), $listing, $request->body(), $request->clientId());
        $conversation = $message->conversation;

        return response()->json([
            'conversation' => (new ConversationResource($conversation))->resolve($request),
            'message' => (new MessageResource($message))->resolve($request),
            // Повтор с тем же client_id возвращает сохранённое сообщение: 200, а не 201.
        ], $message->wasRecentlyCreated ? 201 : 200);
    }

    public function messages(Request $request, Conversation $conversation, ConversationHistory $history): JsonResponse
    {
        $this->authorizeParticipant($request, $conversation);

        $before = $request->integer('before');
        $page = $history->page($conversation, $before > 0 ? $before : null);

        return response()->json([
            'conversation' => (new ConversationResource($conversation))->resolve($request),
            'data' => MessageResource::collection($page['messages'])->resolve($request),
            'meta' => ['has_more' => $page['has_more']],
        ]);
    }

    public function send(SendMessageRequest $request, Conversation $conversation, SendMessage $action): JsonResponse
    {
        $this->authorizeParticipant($request, $conversation);

        $message = $action->handle($this->user($request), $conversation, $request->body(), $request->clientId());

        return (new MessageResource($message))->response()->setStatusCode($message->wasRecentlyCreated ? 201 : 200);
    }

    public function read(Request $request, Conversation $conversation, MarkConversationRead $action, UnreadMessages $unread): JsonResponse
    {
        $this->authorizeParticipant($request, $conversation);

        $user = $this->user($request);
        $action->handle($user, $conversation);

        return response()->json(['unread' => $unread->count($user)]);
    }

    private function authorizeParticipant(Request $request, Conversation $conversation): void
    {
        abort_unless(Gate::forUser($request->user())->allows('view', $conversation), 404);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
