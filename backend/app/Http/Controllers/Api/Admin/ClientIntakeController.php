<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientIntake;
use App\Services\IntakeToClientMapper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientIntakeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $q = ClientIntake::query()
            ->with(['submittedBy:id,name,email', 'invite:id,label'])
            ->orderByDesc('created_at');
        if (is_string($status) && $status !== '' && $status !== 'all') {
            $q->where('status', $status);
        }

        $rows = $q->limit(200)->get();

        return response()->json($rows->map(function (ClientIntake $i) {
            $base = $i->toListArray();
            $base['submitted_by'] = $i->submittedBy
                ? $i->submittedBy->only(['id', 'name', 'email'])
                : null;

            return $base;
        }));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'payload' => ['required', 'array'],
            'payload.brandName' => ['required', 'string', 'max:255'],
            'payload.contactEmail' => ['required', 'string', 'email', 'max:255'],
        ]);

        $payload = $data['payload'];
        $summary = mb_substr(trim($payload['brandName']), 0, 255);

        $intake = ClientIntake::query()->create([
            'payload' => $payload,
            'summary_brand_name' => $summary,
            'status' => ClientIntake::STATUS_PENDING,
            'submitted_by' => $request->user()?->id,
        ]);

        return response()->json($intake->fresh()->toListArray(), 201);
    }

    public function show(ClientIntake $clientIntake): JsonResponse
    {
        $clientIntake->load(['submittedBy:id,name,email', 'reviewedBy:id,name,email', 'invite:id,label']);

        return response()->json($clientIntake->toDetailArray());
    }

    public function reject(Request $request, ClientIntake $clientIntake): JsonResponse
    {
        if ($clientIntake->status !== ClientIntake::STATUS_PENDING) {
            return response()->json(['message' => 'Only pending intakes can be rejected.'], 422);
        }

        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $clientIntake->update([
            'status' => ClientIntake::STATUS_REJECTED,
            'admin_note' => $data['admin_note'] ?? null,
            'reviewed_by' => $request->user()?->id,
            'reviewed_at' => now(),
        ]);

        return response()->json($clientIntake->fresh()->toDetailArray());
    }

    public function approve(Request $request, ClientIntake $clientIntake): JsonResponse
    {
        if ($clientIntake->status !== ClientIntake::STATUS_PENDING) {
            return response()->json(['message' => 'Only pending intakes can be approved.'], 422);
        }

        $payload = $clientIntake->payload;
        if (! is_array($payload) || empty($payload['brandName'])) {
            return response()->json(['message' => 'Invalid intake payload.'], 422);
        }

        $clientEmail = IntakeToClientMapper::normalizeEmail($payload['contactEmail'] ?? null);
        if ($clientEmail === null) {
            return response()->json([
                'message' => 'This intake has no valid client email. Ask the client to submit a new intake using the updated form.',
            ], 422);
        }

        [$brandPrimary, $brandSecondary] = IntakeToClientMapper::extractBrandHexPair($payload['preferredColors'] ?? null);
        $website = IntakeToClientMapper::normalizeWebsite($payload['websiteOrSocial'] ?? null);
        $notes = IntakeToClientMapper::buildNotes($payload);

        $client = DB::transaction(function () use ($clientIntake, $payload, $website, $notes, $brandPrimary, $brandSecondary, $clientEmail, $request) {
            $company = isset($payload['industry']) && is_string($payload['industry']) && trim($payload['industry']) !== ''
                ? trim($payload['industry'])
                : null;

            $brandColors = array_values(array_filter([$brandPrimary, $brandSecondary]));

            $newClient = Client::query()->create([
                'source_intake_id' => $clientIntake->id,
                'name' => trim($payload['brandName']),
                'company' => $company,
                'email' => $clientEmail,
                'phone' => null,
                'website' => $website,
                'address' => null,
                'brand_primary' => $brandPrimary,
                'brand_secondary' => $brandSecondary,
                'brand_colors' => count($brandColors) > 0 ? $brandColors : null,
                'notes' => $notes !== '' ? $notes : null,
            ]);

            $clientIntake->update([
                'status' => ClientIntake::STATUS_CONVERTED,
                'client_id' => $newClient->id,
                'reviewed_by' => $request->user()?->id,
                'reviewed_at' => now(),
                'admin_note' => null,
            ]);

            return $newClient;
        });

        return response()->json([
            'intake' => $clientIntake->fresh()->load(['submittedBy:id,name,email', 'reviewedBy:id,name,email'])->toDetailArray(),
            'client' => $client->fresh()->toApiArray(),
        ]);
    }
}
