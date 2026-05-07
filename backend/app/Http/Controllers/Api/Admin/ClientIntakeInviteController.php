<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientIntakeInvite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientIntakeInviteController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = ClientIntakeInvite::query()
            ->with('createdBy:id,name,email')
            ->orderByDesc('created_at')
            ->limit(80)
            ->get();

        return response()->json($rows->map(function (ClientIntakeInvite $i) {
            return [
                'id' => $i->id,
                'token' => $i->token,
                'label' => $i->label,
                'expires_at' => $i->expires_at?->toIso8601String(),
                'consumed_at' => $i->consumed_at?->toIso8601String(),
                'created_at' => $i->created_at?->toIso8601String(),
                'created_by' => $i->createdBy
                    ? $i->createdBy->only(['id', 'name', 'email'])
                    : null,
            ];
        }));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $days = $data['expires_in_days'] ?? 14;

        $invite = ClientIntakeInvite::query()->create([
            'token' => Str::random(48),
            'label' => isset($data['label']) && $data['label'] !== '' ? $data['label'] : null,
            'expires_at' => now()->addDays($days),
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'id' => $invite->id,
            'token' => $invite->token,
            'path' => '/intake/'.$invite->token,
            'expires_at' => $invite->expires_at->toIso8601String(),
        ], 201);
    }

    public function destroy(ClientIntakeInvite $clientIntakeInvite): JsonResponse
    {
        $clientIntakeInvite->delete();

        return response()->json(['ok' => true]);
    }
}
