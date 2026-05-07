<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClientFileAccessController extends Controller
{
    public function show(Request $request, Client $client, string $kind): StreamedResponse
    {
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        if (! $user->isAdmin() && ! $this->teamMemberCanAccessClient($user->id, $client->id)) {
            abort(403, 'You are not allowed to access this file.');
        }

        $path = null;
        $filename = 'file';
        $mime = 'application/octet-stream';

        if ($kind === 'logo') {
            $path = $client->logo_path;
            $filename = 'logo';
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $mime = match ($ext) {
                'png' => 'image/png',
                'jpg', 'jpeg' => 'image/jpeg',
                'webp' => 'image/webp',
                default => 'image/jpeg',
            };
        } elseif ($kind === 'business-profile') {
            $path = $client->business_profile_pdf_path;
            $filename = 'business-profile.pdf';
            $mime = 'application/pdf';
        } else {
            abort(404);
        }

        if (! $path || ! Storage::disk('public')->exists($path)) {
            abort(404, 'File not found.');
        }

        $headers = [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="'.addslashes($filename).'"',
        ];

        return Storage::disk('public')->response($path, $filename, $headers);
    }

    private function teamMemberCanAccessClient(int $userId, int $clientId): bool
    {
        return Project::query()
            ->where('client_id', $clientId)
            ->whereHas('members', fn ($q) => $q->where('users.id', $userId))
            ->exists();
    }
}
