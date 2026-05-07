<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientIntake;
use App\Models\ClientIntakeInvite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicClientIntakeController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $invite = ClientIntakeInvite::query()->where('token', $token)->first();
        if (! $invite) {
            return response()->json(['message' => 'This link is not valid.'], 404);
        }
        if ($invite->consumed_at !== null) {
            return response()->json([
                'message' => 'This link was already used. Ask your contact for a new invite if you need to send updates.',
            ], 410);
        }
        if ($invite->expires_at !== null && now()->greaterThan($invite->expires_at)) {
            return response()->json(['message' => 'This link has expired. Ask your contact for a new link.'], 404);
        }

        return response()->json([
            'valid' => true,
            'label' => $invite->label,
            'expires_at' => $invite->expires_at?->toIso8601String(),
        ]);
    }

    public function submit(Request $request, string $token): JsonResponse
    {
        $data = $request->validate([
            'payload' => ['required', 'array'],
            'payload.brandName' => ['required', 'string', 'max:255'],
            'payload.contactEmail' => ['required', 'string', 'email', 'max:255'],
        ]);

        $payload = $data['payload'];
        $summary = mb_substr(trim($payload['brandName']), 0, 255);

        $intake = DB::transaction(function () use ($token, $payload, $summary) {
            $invite = ClientIntakeInvite::query()->where('token', $token)->lockForUpdate()->first();
            if (! $invite) {
                abort(404, 'This link is not valid.');
            }
            if ($invite->consumed_at !== null) {
                abort(410, 'This link was already used.');
            }
            if ($invite->expires_at !== null && now()->greaterThan($invite->expires_at)) {
                abort(404, 'This link has expired.');
            }

            $created = ClientIntake::query()->create([
                'invite_id' => $invite->id,
                'payload' => $payload,
                'summary_brand_name' => $summary,
                'status' => ClientIntake::STATUS_PENDING,
                'submitted_by' => null,
            ]);

            $invite->update(['consumed_at' => now()]);

            return $created;
        });

        return response()->json($intake->fresh()->toListArray(), 201);
    }
}
